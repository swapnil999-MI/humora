package com.paylogic.humora.data.remote

import kotlinx.serialization.Serializable

@Serializable
data class ApiResponse<T>(
    val success: Boolean,
    val message: String,
    val data: T? = null
)

sealed interface NetworkResult<out T> {
    data class Success<T>(val data: T, val message: String = "") : NetworkResult<T>
    data class Error(val message: String, val statusCode: Int? = null) : NetworkResult<Nothing>
    data class Exception(val throwable: Throwable) : NetworkResult<Nothing>
}
