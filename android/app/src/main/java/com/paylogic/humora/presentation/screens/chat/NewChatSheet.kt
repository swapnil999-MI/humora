package com.paylogic.humora.presentation.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paylogic.humora.core.theme.TextMutedDark
import com.paylogic.humora.core.theme.TextPrimaryDark
import com.paylogic.humora.data.model.ChatContact

/** Pick a colleague to message, or several to start a group. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewChatSheet(
    contacts: List<ChatContact>,
    onDismiss: () -> Unit,
    onDirect: (String) -> Unit,
    onGroup: (String, List<String>) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var groupMode by remember { mutableStateOf(false) }
    var groupName by remember { mutableStateOf("") }
    val selected = remember { mutableStateListOf<String>() }

    val visible = contacts.filter {
        query.isBlank() || it.name.contains(query, true) || it.role.contains(query, true) || it.department.contains(query, true)
    }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF111B21)) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(0.9f).padding(horizontal = 16.dp)) {
            Text(if (groupMode) "New group" else "New chat", color = TextPrimaryDark, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            if (groupMode) {
                OutlinedTextField(
                    value = groupName, onValueChange = { groupName = it.take(80) },
                    label = { Text("Group name") }, singleLine = true, modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(8.dp))
            }
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                placeholder = { Text("Search people") }, singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            if (!groupMode) {
                Row(
                    Modifier.fillMaxWidth().clickable { groupMode = true }.padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.GroupAdd, contentDescription = null, tint = Color(0xFF00A884), modifier = Modifier.size(28.dp))
                    Spacer(Modifier.width(14.dp))
                    Text("New group", color = TextPrimaryDark, fontSize = 15.sp)
                }
            }
            if (contacts.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("Loading people…", color = TextMutedDark, fontSize = 13.sp)
                }
            }
            LazyColumn(Modifier.weight(1f)) {
                items(visible, key = { it.userId }) { c ->
                    val isSelected = c.userId in selected
                    Row(
                        Modifier.fillMaxWidth()
                            .clickable {
                                if (!groupMode) onDirect(c.userId)
                                else if (isSelected) selected.remove(c.userId) else selected.add(c.userId)
                            }
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Avatar(c.name, false, 42)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(c.name, color = TextPrimaryDark, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val detail = listOf(c.role, c.department).filter { it.isNotBlank() }.joinToString(" · ")
                            if (detail.isNotBlank()) Text(detail, color = TextMutedDark, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        if (groupMode) {
                            Icon(
                                if (isSelected) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                contentDescription = if (isSelected) "Selected" else "Not selected",
                                tint = if (isSelected) Color(0xFF00A884) else TextMutedDark
                            )
                        }
                    }
                }
            }
            if (groupMode) {
                Button(
                    onClick = { onGroup(groupName.trim(), selected.toList()) },
                    enabled = groupName.isNotBlank() && selected.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)
                ) {
                    Text("Create group (${selected.size})", color = Color.Black)
                }
            }
        }
    }
}
