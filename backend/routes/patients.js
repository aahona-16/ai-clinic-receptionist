const express = require("express")
const router = express.Router()
const fs = require("fs")
const path = require("path")

const file = path.join(__dirname,"../database/patients.json")

function read(){
return JSON.parse(fs.readFileSync(file))
}

function write(data){
fs.writeFileSync(file,JSON.stringify(data,null,2))
}

// POST - Add or update a patient visit
router.post("/",(req,res)=>{

let patients = read()

const name = req.body.name

let patient = patients.find(p=>p.name===name)

if(patient){

patient.visits++
patient.lastVisit=new Date()

}else{

patient={
name,
visits:1,
lastVisit:new Date()
}

patients.push(patient)

}

write(patients)

res.json(patient)

})

// GET - Fetch all patients
router.get("/",(req,res)=>{
res.json(read())
})

// DELETE - Delete a patient
router.delete("/",(req,res)=>{
let patients = read()
const name = req.body.name

patients = patients.filter(p => p.name !== name)
write(patients)

res.json({ success: true, message: 'Patient deleted' })
})

module.exports=router