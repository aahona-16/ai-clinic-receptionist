const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const path = require("path")

const appointments = require("./routes/appointments")
const patients = require("./routes/patients")
const schedule = require("./routes/schedule")

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.use(express.static(path.join(__dirname,"../frontend")))

app.use("/appointments",appointments)
app.use("/patients",patients)
app.use("/schedule",schedule)

const PORT = 4000

app.listen(PORT,()=>{
console.log("AI receptionist running at http://localhost:4000")
})
