const container=document.getElementById("assistant")

const canvas=document.createElement("canvas")
canvas.width=200
canvas.height=200

container.appendChild(canvas)

const ctx=canvas.getContext("2d")

let angle=0

function draw(){

ctx.clearRect(0,0,200,200)

ctx.beginPath()

ctx.arc(100,100,60+Math.sin(angle)*5,0,Math.PI*2)

ctx.fillStyle="#3b82f6"

ctx.shadowBlur=20
ctx.shadowColor="#3b82f6"

ctx.fill()

angle+=0.05

requestAnimationFrame(draw)

}

draw()