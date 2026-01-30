import SwiftUI

struct AgentSession: Identifiable, Equatable {
    let id: UUID
    var name: String
    var isPinned: Bool
    var unread: Int
    var messages: [Message]
    var lastActivity: Date

    var preview: String {
        messages.last?.text ?? ""
    }

    var timeLabel: String {
        let calendar = Calendar.current
        if calendar.isDateInToday(lastActivity) {
            return Self.timeFormatter.string(from: lastActivity)
        }
        return Self.dateFormatter.string(from: lastActivity)
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()
}

struct Message: Identifiable, Equatable {
    let id: UUID
    var text: String
    var isOutgoing: Bool
    var timestamp: Date

    var timeLabel: String {
        Message.timeFormatter.string(from: timestamp)
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()
}

private let sampleSessions: [AgentSession] = [
    AgentSession(
        id: UUID(),
        name: "Lumina Agent",
        isPinned: true,
        unread: 2,
        messages: [
            Message(id: UUID(), text: "Hi, welcome to Lumina Mobile.", isOutgoing: false, timestamp: Date().addingTimeInterval(-3600)),
            Message(id: UUID(), text: "How do I pair?", isOutgoing: true, timestamp: Date().addingTimeInterval(-3500)),
            Message(id: UUID(), text: "Open Settings > Mobile Connect and scan the QR.", isOutgoing: false, timestamp: Date().addingTimeInterval(-3400))
        ],
        lastActivity: Date().addingTimeInterval(-3400)
    ),
    AgentSession(
        id: UUID(),
        name: "Research Agent",
        isPinned: false,
        unread: 0,
        messages: [
            Message(id: UUID(), text: "Draft summary looks good.", isOutgoing: false, timestamp: Date().addingTimeInterval(-86400 * 1))
        ],
        lastActivity: Date().addingTimeInterval(-86400 * 1)
    ),
    AgentSession(
        id: UUID(),
        name: "Tasks Agent",
        isPinned: false,
        unread: 0,
        messages: [
            Message(id: UUID(), text: "3 items extracted.", isOutgoing: false, timestamp: Date().addingTimeInterval(-86400 * 2))
        ],
        lastActivity: Date().addingTimeInterval(-86400 * 2)
    )
]

struct ContentView: View {
    @AppStorage("lumina_paired") private var isPaired = false

    var body: some View {
        if isPaired {
            SessionListView()
        } else {
            PairingView(isPaired: $isPaired)
        }
    }
}

struct PairingView: View {
    @Binding var isPaired: Bool
    @State private var payload = ""

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 64))
                .foregroundStyle(.blue)

            Text("Pair with Desktop")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Scan the QR code shown in Lumina Desktop > Settings > Mobile Connect.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Button(action: {}) {
                Text("Scan QR")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 8) {
                Text("Or paste pairing payload")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextField("{ \"token\": ... }", text: $payload)
                    .textFieldStyle(.roundedBorder)
            }
            .padding(.horizontal, 32)

            Button(action: {
                let trimmed = payload.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    isPaired = true
                }
            }) {
                Text("Pair")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .padding(.horizontal, 32)
            .disabled(payload.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

struct SessionListView: View {
    @State private var sessions = sampleSessions
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            List {
                ForEach(filteredSessions) { session in
                    NavigationLink(value: session.id) {
                        SessionRow(session: session)
                    }
                    .listRowBackground(Color(.secondarySystemGroupedBackground))
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            togglePin(session.id)
                        } label: {
                            Label(session.isPinned ? "Unpin" : "Pin", systemImage: session.isPinned ? "pin.slash" : "pin")
                        }
                        .tint(session.isPinned ? .gray : .blue)
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Chats")
            .navigationDestination(for: UUID.self) { id in
                if let index = sessions.firstIndex(where: { $0.id == id }) {
                    SessionDetailView(session: $sessions[index])
                }
            }
            .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always))
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Edit") {}
                        .foregroundStyle(.blue)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {}) {
                        Image(systemName: "square.and.pencil")
                    }
                    .foregroundStyle(.blue)
                }
            }
        }
    }

    private var filteredSessions: [AgentSession] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let visible = query.isEmpty
            ? sessions
            : sessions.filter { $0.name.localizedCaseInsensitiveContains(query) || $0.preview.localizedCaseInsensitiveContains(query) }
        return visible.sorted { lhs, rhs in
            if lhs.isPinned != rhs.isPinned {
                return lhs.isPinned && !rhs.isPinned
            }
            return lhs.lastActivity > rhs.lastActivity
        }
    }

    private func togglePin(_ id: UUID) {
        guard let index = sessions.firstIndex(where: { $0.id == id }) else { return }
        sessions[index].isPinned.toggle()
    }
}

struct SessionRow: View {
    let session: AgentSession

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(.systemGray4))
                .frame(width: 44, height: 44)
                .overlay(
                    Text(String(session.name.prefix(1)))
                        .font(.headline)
                        .foregroundStyle(.white)
                )

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(session.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.primary)
                    Spacer()
                    HStack(spacing: 4) {
                        if session.isPinned {
                            Image(systemName: "pin.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                        }
                        Text(session.timeLabel)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }

                HStack {
                    Text(session.preview)
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                    if session.unread > 0 {
                        Text("\(session.unread)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.blue))
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }
}

struct SessionDetailView: View {
    @Binding var session: AgentSession
    @State private var message = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(session.messages) { msg in
                        MessageBubble(message: msg)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 16)
            }
            .background(Color(.systemGroupedBackground))

            Divider()

            HStack(spacing: 8) {
                TextField("Message", text: $message)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    sendMessage()
                }
                .buttonStyle(.borderedProminent)
                .disabled(message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(12)
            .background(Color(.secondarySystemBackground))
        }
        .navigationTitle(session.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func sendMessage() {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let newMessage = Message(id: UUID(), text: trimmed, isOutgoing: true, timestamp: Date())
        session.messages.append(newMessage)
        session.lastActivity = newMessage.timestamp
        session.unread = 0
        message = ""
    }
}

struct MessageBubble: View {
    let message: Message

    var body: some View {
        HStack {
            if message.isOutgoing { Spacer() }
            VStack(alignment: .leading, spacing: 4) {
                Text(message.text)
                    .font(.system(size: 15))
                    .foregroundStyle(message.isOutgoing ? .white : .primary)
                Text(message.timeLabel)
                    .font(.system(size: 11))
                    .foregroundStyle(message.isOutgoing ? .white.opacity(0.8) : .secondary)
            }
            .padding(10)
            .background(message.isOutgoing ? Color.blue : Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            if !message.isOutgoing { Spacer() }
        }
        .padding(message.isOutgoing ? .leading : .trailing, 40)
    }
}

#Preview {
    ContentView()
}
