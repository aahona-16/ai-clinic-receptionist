const express = require("express")
const router = express.Router()
const fs = require("fs")
const path = require("path")

const scheduleFile = path.join(__dirname,"../database/doctorSchedule.json")
const appointmentsFile = path.join(__dirname,"../database/appointments.json")

function toDateKey(date){
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function generateRollingSchedule(days = 90){
  const baseSlots = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]
  const today = new Date()
  const generated = {}

  for(let i = 0; i < days; i++){
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    generated[toDateKey(d)] = [...baseSlots]
  }

  return generated
}

function readSchedule(){
  let stored = {}
  try {
    stored = JSON.parse(fs.readFileSync(scheduleFile))
  } catch (e) {
    stored = {}
  }

  // Keep stored custom schedule, and ensure current + upcoming real dates always exist.
  const rolling = generateRollingSchedule(30)
  return { ...rolling, ...stored }
}

function readAppointments(){
  return JSON.parse(fs.readFileSync(appointmentsFile))
}

function getAvailableSlotsByDate(days = 30, maxDates = 5){
  const schedule = readSchedule()
  const appointments = readAppointments()
  const today = new Date()
  const available = []

  for(let i = 0; i < days; i++){
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dateKey = toDateKey(d)
    const daySlots = schedule[dateKey] || []

    if(daySlots.length === 0) continue

    const freeSlots = daySlots.filter(slot => {
      const booked = appointments.find(a => a.date === dateKey && a.time === slot)
      return !booked
    })

    if(freeSlots.length > 0){
      available.push({ date: dateKey, slots: freeSlots })
    }

    if(available.length >= maxDates) break
  }

  return available
}

router.get('/available', (req, res) => {
  const days = Math.max(1, Math.min(180, Number(req.query.days) || 30))
  const maxDates = Math.max(1, Math.min(10, Number(req.query.maxDates) || 5))
  const available = getAvailableSlotsByDate(days, maxDates)

  res.json({
    bookingWindowDays: 90,
    available
  })
})

router.get('/available/:date', (req, res) => {
  const date = req.params.date
  const schedule = readSchedule()
  const appointments = readAppointments()
  const daySlots = schedule[date] || []

  const freeSlots = daySlots.filter(slot => {
    const booked = appointments.find(a => a.date === date && a.time === slot)
    return !booked
  })

  res.json({
    date,
    slots: freeSlots,
    bookingWindowDays: 90
  })
})

router.post("/check",(req,res)=>{

  const {date,time} = req.body

  const schedule = readSchedule()
  const appointments = readAppointments()

  if(!schedule[date]){
    return res.json({available:false})
  }

  if(!schedule[date].includes(time)){
    return res.json({available:false})
  }

  const booked = appointments.find(
    a => a.date === date && a.time === time
  )

  if(booked){
    return res.json({available:false})
  }

  res.json({available:true})

})

module.exports = router