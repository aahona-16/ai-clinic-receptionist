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

router.get("/",(req,res)=>{
res.json(read())
})

module.exports=router