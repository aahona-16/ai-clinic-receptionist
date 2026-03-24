const express = require("express")
const router = express.Router()
const fs = require("fs")
const path = require("path")

const file = path.join(__dirname,"../database/appointments.json")

function read(){
return JSON.parse(fs.readFileSync(file))
}

function write(data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

router.get("/",(req,res)=>{
res.json(read())
})

router.post("/",(req,res)=>{

let data = read()

const appointment = {
name:req.body.name,
issue:req.body.issue,
date:req.body.date,
time:req.body.time,
createdAt:new Date()
}

data.push(appointment)

write(data)

res.json(appointment)

})

module.exports = router