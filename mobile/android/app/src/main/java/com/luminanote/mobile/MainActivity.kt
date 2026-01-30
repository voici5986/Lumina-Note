package com.luminanote.mobile

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.UUID

private data class Message(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val isOutgoing: Boolean,
    val timeLabel: String
)

private data class AgentSession(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val isPinned: Boolean,
    val unread: Int,
    val messages: List<Message>,
    val lastActivityLabel: String
)

private fun sampleSessions(): List<AgentSession> {
    return listOf(
        AgentSession(
            name = "Lumina Agent",
            isPinned = true,
            unread = 2,
            messages = listOf(
                Message(text = "Hi, welcome to Lumina Mobile.", isOutgoing = false, timeLabel = "09:39"),
                Message(text = "How do I pair?", isOutgoing = true, timeLabel = "09:40"),
                Message(text = "Open Settings > Mobile Connect and scan the QR.", isOutgoing = false, timeLabel = "09:41")
            ),
            lastActivityLabel = "09:41"
        ),
        AgentSession(
            name = "Research Agent",
            isPinned = false,
            unread = 0,
            messages = listOf(
                Message(text = "Draft summary looks good.", isOutgoing = false, timeLabel = "Yesterday")
            ),
            lastActivityLabel = "Yesterday"
        ),
        AgentSession(
            name = "Tasks Agent",
            isPinned = false,
            unread = 0,
            messages = listOf(
                Message(text = "3 items extracted.", isOutgoing = false, timeLabel = "Mon")
            ),
            lastActivityLabel = "Mon"
        )
    )
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    LuminaMobileApp()
                }
            }
        }
    }
}

@Composable
fun LuminaMobileApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    var isPaired by remember { mutableStateOf(PairingPrefs.isPaired(context)) }

    if (!isPaired) {
        PairingScreen(
            onPaired = {
                PairingPrefs.setPaired(context, true)
                isPaired = true
            }
        )
        return
    }

    val sessions = remember { mutableStateListOf(*sampleSessions().toTypedArray()) }
    var search by remember { mutableStateOf("") }
    var activeSessionId by remember { mutableStateOf<String?>(null) }

    if (activeSessionId == null) {
        ChatListScreen(
            sessions = sessions,
            search = search,
            onSearchChange = { search = it },
            onSelectSession = { activeSessionId = it },
            onTogglePin = { sessionId ->
                val index = sessions.indexOfFirst { it.id == sessionId }
                if (index != -1) {
                    val session = sessions[index]
                    sessions[index] = session.copy(isPinned = !session.isPinned)
                }
            }
        )
    } else {
        val index = sessions.indexOfFirst { it.id == activeSessionId }
        if (index == -1) {
            activeSessionId = null
        } else {
            ChatDetailScreen(
                session = sessions[index],
                onBack = { activeSessionId = null },
                onSend = { text ->
                    val session = sessions[index]
                    val newMessage = Message(text = text, isOutgoing = true, timeLabel = "Now")
                    val updated = session.copy(
                        messages = session.messages + newMessage,
                        lastActivityLabel = "Now",
                        unread = 0
                    )
                    sessions[index] = updated
                }
            )
        }
    }
}

@Composable
private fun PairingScreen(onPaired: () -> Unit) {
    var payload by remember { mutableStateOf("") }

    Scaffold { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF2F2F7))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.QrCodeScanner,
                contentDescription = null,
                tint = Color(0xFF007AFF),
                modifier = Modifier.size(72.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text("Pair with Desktop", fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Scan the QR code shown in Lumina Desktop > Settings > Mobile Connect.",
                textAlign = TextAlign.Center,
                color = Color(0xFF8E8E93)
            )
            Spacer(modifier = Modifier.height(20.dp))
            Button(onClick = {}) {
                Text("Scan QR")
            }
            Spacer(modifier = Modifier.height(16.dp))
            TextField(
                value = payload,
                onValueChange = { payload = it },
                placeholder = { Text("Paste pairing payload") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = {
                if (payload.trim().isNotEmpty()) {
                    onPaired()
                }
            }) {
                Text("Pair")
            }
        }
    }
}

@Composable
private fun ChatListScreen(
    sessions: List<AgentSession>,
    search: String,
    onSearchChange: (String) -> Unit,
    onSelectSession: (String) -> Unit,
    onTogglePin: (String) -> Unit
) {
    val filtered = sessions
        .filter {
            search.isBlank() || it.name.contains(search, true) || it.messages.lastOrNull()?.text?.contains(search, true) == true
        }
        .sortedWith(compareByDescending<AgentSession> { it.isPinned }.thenByDescending { it.lastActivityLabel })

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chats", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    TextButton(onClick = {}) {
                        Text("Edit", color = Color(0xFF007AFF))
                    }
                },
                actions = {
                    TextButton(onClick = {}) {
                        Icon(Icons.Default.Edit, contentDescription = "Compose", tint = Color(0xFF007AFF))
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF2F2F7))
        ) {
            TextField(
                value = search,
                onValueChange = onSearchChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                placeholder = { Text("Search") }
            )
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(filtered) { chat ->
                    ChatRow(chat = chat, onClick = { onSelectSession(chat.id) }, onTogglePin = { onTogglePin(chat.id) })
                    Divider(color = Color(0xFFE5E5EA))
                }
            }
        }
    }
}

@Composable
private fun ChatRow(chat: AgentSession, onClick: () -> Unit, onTogglePin: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .background(Color(0xFFFFFFFF))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(Color(0xFFD1D1D6), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(text = chat.name.take(1), color = Color.White, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = chat.name,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                Text(text = chat.lastActivityLabel, fontSize = 12.sp, color = Color(0xFF8E8E93))
            }
            Spacer(modifier = Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = chat.messages.lastOrNull()?.text ?: "",
                    fontSize = 14.sp,
                    color = Color(0xFF8E8E93),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (chat.unread > 0) {
                    Box(
                        modifier = Modifier
                            .padding(start = 8.dp)
                            .background(Color(0xFF007AFF), RoundedCornerShape(12.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = chat.unread.toString(), color = Color.White, fontSize = 12.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = if (chat.isPinned) "PIN" else "",
            fontSize = 10.sp,
            color = Color(0xFF8E8E93),
            modifier = Modifier.clickable { onTogglePin() }
        )
    }
}

@Composable
private fun ChatDetailScreen(session: AgentSession, onBack: () -> Unit, onSend: (String) -> Unit) {
    var draft by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(session.name, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF2F2F7))
        ) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(session.messages) { msg ->
                    MessageBubble(message = msg)
                }
            }
            Divider(color = Color(0xFFE5E5EA))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF9F9FB))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = draft,
                    onValueChange = { draft = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Message") }
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(onClick = {
                    val trimmed = draft.trim()
                    if (trimmed.isNotEmpty()) {
                        onSend(trimmed)
                        draft = ""
                    }
                }) {
                    Text("Send")
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: Message) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.isOutgoing) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier
                .background(
                    if (message.isOutgoing) Color(0xFF007AFF) else Color(0xFFE5E5EA),
                    RoundedCornerShape(16.dp)
                )
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Text(
                text = message.text,
                color = if (message.isOutgoing) Color.White else Color.Black,
                fontSize = 14.sp
            )
            Text(
                text = message.timeLabel,
                color = if (message.isOutgoing) Color(0xCCFFFFFF) else Color(0xFF6D6D72),
                fontSize = 10.sp
            )
        }
    }
}

private object PairingPrefs {
    private const val PREFS = "lumina_mobile"
    private const val KEY_PAIRED = "paired"

    fun isPaired(context: Context): Boolean {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_PAIRED, false)
    }

    fun setPaired(context: Context, paired: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_PAIRED, paired)
            .apply()
    }
}
