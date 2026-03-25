const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const path = require("path")
const http = require("http")
const fs = require("fs")
const { Server } = require("socket.io")

const appointments = require("./routes/appointments")
const patients = require("./routes/patients")
const schedule = require("./routes/schedule")

const app = express()
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
})

app.use(cors())
app.use(bodyParser.json())

app.use(express.static(path.join(__dirname,"../frontend")))

app.use("/appointments",appointments)
app.use("/patients",patients)
app.use("/schedule",schedule)

let doctorAvailable = false
const clients = new Map()
const callPartners = new Map()
const chatHistoryFile = path.join(__dirname, "database", "liveChat.json")

function ensureChatHistoryFile() {
	if (!fs.existsSync(chatHistoryFile)) {
		fs.writeFileSync(chatHistoryFile, JSON.stringify([], null, 2))
	}
}

function readChatHistory() {
	try {
		ensureChatHistoryFile()
		return JSON.parse(fs.readFileSync(chatHistoryFile, "utf-8"))
	} catch (_) {
		return []
	}
}

function appendChatHistory(message) {
	try {
		const existing = readChatHistory()
		existing.push(message)
		const trimmed = existing.slice(-300)
		fs.writeFileSync(chatHistoryFile, JSON.stringify(trimmed, null, 2))
	} catch (_) {}
}

function clearCallForSocket(socketId, reason = "Call ended") {
	const partnerId = callPartners.get(socketId)
	if (!partnerId) return

	callPartners.delete(socketId)
	callPartners.delete(partnerId)

	io.to(socketId).emit("video-call-ended", { reason })
	io.to(partnerId).emit("video-call-ended", { reason })
}

function getAdminSocketIds() {
	const ids = []
	clients.forEach((meta, socketId) => {
		if (meta.role === "admin") ids.push(socketId)
	})
	return ids
}

io.on("connection", (socket) => {
	socket.emit("doctor-availability", { available: doctorAvailable })

	socket.on("register-role", (payload = {}) => {
		const role = payload.role === "admin" ? "admin" : "patient"
		const name = payload.name || (role === "admin" ? "Admin" : `Patient-${socket.id.slice(0, 4)}`)
		clients.set(socket.id, { role, name })
		socket.emit("registered", { socketId: socket.id, role, name, doctorAvailable })
		socket.emit("chat-history", readChatHistory())
	})

	socket.on("set-doctor-availability", (payload = {}) => {
		const user = clients.get(socket.id)
		if (!user || user.role !== "admin") return

		doctorAvailable = !!payload.available
		io.emit("doctor-availability", { available: doctorAvailable })
	})

	socket.on("chat-message", (payload = {}) => {
		const user = clients.get(socket.id)
		if (!user) return

		const text = String(payload.text || "").trim()
		if (!text) return

		const message = {
			text,
			fromRole: user.role,
			fromName: user.name,
			urgent: !!payload.urgent,
			ts: Date.now()
		}

		appendChatHistory(message)
		io.emit("chat-message", message)
	})

	socket.on("urgent-request", (payload = {}) => {
		const user = clients.get(socket.id)
		if (!user || user.role !== "patient") return

		const msg = {
			fromSocketId: socket.id,
			fromName: user.name,
			reason: String(payload.reason || "Urgent help needed"),
			ts: Date.now()
		}

		getAdminSocketIds().forEach(adminId => io.to(adminId).emit("urgent-request", msg))
	})

	socket.on("video-call-request", () => {
		const user = clients.get(socket.id)
		if (!user || user.role !== "patient") return

		if (!doctorAvailable) {
			socket.emit("video-call-status", { ok: false, message: "Doctor is not free right now." })
			return
		}

		const request = {
			fromSocketId: socket.id,
			fromName: user.name,
			ts: Date.now()
		}
		getAdminSocketIds().forEach(adminId => io.to(adminId).emit("video-call-request", request))
		socket.emit("video-call-status", { ok: true, message: "Waiting for admin to accept your video call." })
	})

	socket.on("video-call-accepted", (payload = {}) => {
		const user = clients.get(socket.id)
		if (!user || user.role !== "admin") return

		const toSocketId = payload.toSocketId
		if (!toSocketId) return

		io.to(toSocketId).emit("video-call-accepted", {
			bySocketId: socket.id,
			byName: user.name
		})
		callPartners.set(socket.id, toSocketId)
		callPartners.set(toSocketId, socket.id)

		io.to(socket.id).emit("video-call-active", { withSocketId: toSocketId })
		io.to(toSocketId).emit("video-call-active", { withSocketId: socket.id })
		socket.emit("video-call-status", { ok: true, message: "Video call accepted." })
	})

	socket.on("video-call-rejected", (payload = {}) => {
		const user = clients.get(socket.id)
		if (!user || user.role !== "admin") return
		if (!payload.toSocketId) return

		io.to(payload.toSocketId).emit("video-call-status", { ok: false, message: "Admin rejected the video call." })
	})

	socket.on("end-video-call", (payload = {}) => {
		const targetId = payload.toSocketId || callPartners.get(socket.id)
		if (!targetId) return

		callPartners.delete(socket.id)
		callPartners.delete(targetId)

		io.to(socket.id).emit("video-call-ended", { reason: "Call ended by participant." })
		io.to(targetId).emit("video-call-ended", { reason: "Call ended by participant." })
	})

	socket.on("webrtc-offer", (payload = {}) => {
		if (!payload.to || !payload.offer) return
		io.to(payload.to).emit("webrtc-offer", { from: socket.id, offer: payload.offer })
	})

	socket.on("webrtc-answer", (payload = {}) => {
		if (!payload.to || !payload.answer) return
		io.to(payload.to).emit("webrtc-answer", { from: socket.id, answer: payload.answer })
	})

	socket.on("webrtc-ice-candidate", (payload = {}) => {
		if (!payload.to || !payload.candidate) return
		io.to(payload.to).emit("webrtc-ice-candidate", { from: socket.id, candidate: payload.candidate })
	})

	socket.on("disconnect", () => {
		clearCallForSocket(socket.id, "Call ended (participant disconnected).")
		clients.delete(socket.id)
	})
})

const PORT = 5000

httpServer.listen(PORT,()=>{
console.log("AI receptionist running at http://localhost:5000")
})
