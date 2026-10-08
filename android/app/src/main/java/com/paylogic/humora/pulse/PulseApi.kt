package com.paylogic.humora.pulse

import com.paylogic.humora.data.remote.HumoraApiClient
import com.paylogic.humora.data.remote.NetworkConfig
import com.paylogic.humora.data.remote.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/** An HTTP call to the Pulse API failed; [status] is 0 when the server was not reached. */
class PulseHttpException(val status: Int, message: String) : IOException(message) {
    val transient: Boolean get() = status == 0 || status == 429 || status >= 500
}

@Serializable
data class PulseMember(
    @SerialName("user_id") val userId: String,
    val role: String = "member",
    @SerialName("joined_seq") val joinedSeq: Long = 0,
    @SerialName("delivered_seq") var deliveredSeq: Long = 0,
    @SerialName("read_seq") var readSeq: Long = 0,
)

@Serializable
data class PulseConversation(
    val id: String,
    /** dm | group | channel */
    val kind: String,
    val name: String = "",
    val topic: String = "",
    @SerialName("is_private") val isPrivate: Boolean = true,
    @SerialName("created_by") val createdBy: String = "",
    @SerialName("last_seq") var lastSeq: Long = 0,
    var epoch: Long = 0,
    @SerialName("last_message_at") var lastMessageAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    val members: List<PulseMember> = emptyList(),
)

@Serializable
internal data class DeviceInfo(val id: String, @SerialName("user_id") val userId: String)

@Serializable
internal data class ClaimedKeyPackage(@SerialName("device_id") val deviceId: String, @SerialName("key_package") val keyPackage: String)

@Serializable
internal data class MediaSlot(@SerialName("object_key") val objectKey: String, val url: String, val fields: Map<String, String>)

/**
 * The Pulse REST endpoints (/api/v1/pulse/...). Uses the app's session and refreshes an expired
 * access token once before giving up, like the rest of the app.
 */
internal class PulseApi(
    private val http: OkHttpClient,
    private val session: SessionManager,
    private val apiClient: HumoraApiClient,
) {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    private val jsonType = "application/json".toMediaType()

    // ── Devices & keys ──

    suspend fun registerDevice(id: String, name: String, identityKey: ByteArray, keyPackages: List<String>) {
        call<JsonElement>(
            "POST", "pulse/devices",
            json.encodeToString(RegisterDevice.serializer(), RegisterDevice(id, "android", name, Ids.b64(identityKey), keyPackages)),
            JsonElement.serializer(),
        )
    }

    suspend fun revokeDevice(id: String) {
        call("DELETE", "pulse/devices/$id", null, JsonElement.serializer())
    }

    suspend fun setPushToken(deviceId: String, token: String) {
        call("PUT", "pulse/devices/$deviceId/push-token",
            json.encodeToString(PushToken.serializer(), PushToken(token)), JsonElement.serializer())
    }

    suspend fun keyPackagesRemaining(deviceId: String): Int =
        call("GET", "pulse/devices/$deviceId/key-packages", null, JsonElement.serializer())
            .jsonObject["remaining"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0

    suspend fun addKeyPackages(deviceId: String, keyPackages: List<String>) {
        call("POST", "pulse/devices/$deviceId/key-packages",
            json.encodeToString(KeyPackages.serializer(), KeyPackages(keyPackages)), JsonElement.serializer())
    }

    suspend fun lookupDevices(userIds: List<String>): List<DeviceInfo> =
        call("POST", "pulse/devices/lookup",
            json.encodeToString(UserIds.serializer(), UserIds(userIds)), ListSerializer(DeviceInfo.serializer()))

    suspend fun claimKeyPackages(userId: String): List<ClaimedKeyPackage> =
        call("POST", "pulse/users/$userId/key-packages/claim", "{}", ListSerializer(ClaimedKeyPackage.serializer()))

    suspend fun wsTicket(deviceId: String): String =
        call("POST", "pulse/ws-ticket", json.encodeToString(Ticket.serializer(), Ticket(deviceId)), JsonElement.serializer())
            .jsonObject["ticket"]!!.jsonPrimitive.content

    // ── Conversations ──

    suspend fun conversations(): List<PulseConversation> =
        call("GET", "pulse/conversations", null, ListSerializer(PulseConversation.serializer()))

    suspend fun conversation(id: String): PulseConversation =
        call("GET", "pulse/conversations/$id", null, PulseConversation.serializer())

    suspend fun createConversation(kind: String, memberIds: List<String>, name: String, topic: String, isPrivate: Boolean): PulseConversation =
        call("POST", "pulse/conversations",
            json.encodeToString(CreateConversation.serializer(), CreateConversation(kind, name, topic, isPrivate, memberIds)),
            PulseConversation.serializer())

    // ── Encrypted attachments ──

    suspend fun mediaUploadSlot(conversationId: String, sizeBytes: Long): MediaSlot =
        call("POST", "pulse/media/upload-url",
            json.encodeToString(MediaUpload.serializer(), MediaUpload(conversationId, sizeBytes)), MediaSlot.serializer())

    suspend fun mediaDownloadUrl(conversationId: String, objectKey: String): String =
        call("POST", "pulse/media/download-url",
            json.encodeToString(MediaDownload.serializer(), MediaDownload(conversationId, objectKey)), JsonElement.serializer())
            .jsonObject["url"]!!.jsonPrimitive.content

    // ── Transport ──

    /** The gateway URL for a ticket: the API base with ws(s):// and /pulse/ws. */
    fun gatewayUrl(ticket: String): String {
        val base = NetworkConfig.baseUrl.trimEnd('/')
        val ws = when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
            else -> base
        }
        return "$ws/pulse/ws?ticket=$ticket"
    }

    private suspend fun <T> call(method: String, path: String, body: String?, serializer: KSerializer<T>): T =
        withContext(Dispatchers.IO) {
            var token = session.accessToken
            var response = execute(method, path, body, token)
            if (response.first == 401 && token.isNotBlank() && apiClient.refreshSession(token)) {
                token = session.accessToken
                response = execute(method, path, body, token)
            }
            val (status, text) = response
            val envelope = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull()
            val message = envelope?.get("message")?.jsonPrimitive?.content ?: "HTTP $status"
            if (status !in 200..299 || envelope?.get("success")?.jsonPrimitive?.content == "false") {
                throw PulseHttpException(status, message)
            }
            var data = envelope?.get("data") ?: JsonNull
            // Go encodes an empty slice as null.
            if (data is JsonNull && serializer.descriptor.kind == StructureKind.LIST) data = JsonArray(emptyList())
            json.decodeFromJsonElement(serializer, data)
        }

    private fun execute(method: String, path: String, body: String?, token: String): Pair<Int, String> {
        val url = NetworkConfig.baseUrl.trimEnd('/') + "/" + path
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .apply { if (token.isNotBlank()) header("Authorization", "Bearer $token") }
            .method(method, body?.toRequestBody(jsonType) ?: if (method == "GET" || method == "DELETE") null else "{}".toRequestBody(jsonType))
            .build()
        return try {
            http.newCall(request).execute().use { it.code to (it.body?.string() ?: "") }
        } catch (e: IOException) {
            throw PulseHttpException(0, e.message ?: "network error")
        }
    }

    @Serializable private data class RegisterDevice(
        val id: String, val platform: String, val name: String,
        @SerialName("identity_key") val identityKey: String, @SerialName("key_packages") val keyPackages: List<String>,
    )
    @Serializable private data class PushToken(val token: String)
    @Serializable private data class KeyPackages(@SerialName("key_packages") val keyPackages: List<String>)
    @Serializable private data class UserIds(@SerialName("user_ids") val userIds: List<String>)
    @Serializable private data class Ticket(@SerialName("device_id") val deviceId: String)
    @Serializable private data class CreateConversation(
        val kind: String, val name: String, val topic: String,
        @SerialName("is_private") val isPrivate: Boolean, @SerialName("member_ids") val memberIds: List<String>,
    )
    @Serializable private data class MediaUpload(@SerialName("conversation_id") val conversationId: String, @SerialName("size_bytes") val sizeBytes: Long)
    @Serializable private data class MediaDownload(@SerialName("conversation_id") val conversationId: String, @SerialName("object_key") val objectKey: String)
}
