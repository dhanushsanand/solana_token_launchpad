import express from "express";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware/auth";

const app = express();
app.use(express.json());

// TODO: GET /api/health
// TODO: POST /api/auth/register
// TODO: POST /api/auth/login
// TODO: POST /api/launches (with tiers?, vesting?)
// TODO: GET /api/launches (?page, ?limit, ?status)
// TODO: GET /api/launches/:id (with computed status)
// TODO: PUT /api/launches/:id
// TODO: POST /api/launches/:id/whitelist
// TODO: GET /api/launches/:id/whitelist
// TODO: DELETE /api/launches/:id/whitelist/:address
// TODO: POST /api/launches/:id/referrals
// TODO: GET /api/launches/:id/referrals
// TODO: POST /api/launches/:id/purchase (with referralCode?, tier pricing, sybil protection)
// TODO: GET /api/launches/:id/purchases
// TODO: GET /api/launches/:id/vesting?walletAddress=

app.get("/api/health", (req, res)=>{
  return res.status(200).json({status:"ok"});
})

async function existingUser(email:string) {
  return await prisma.user.findUnique({where:{email}});
}

app.post("/api/auth/register", async (req, res)=>{
  const {name, email, password} = req.body;
  if (!name || !email || !password){
    return res.status(400).json({
      error:"Mssing a Value"
    });
  }
  if(await existingUser(email)){
    return res.status(409).json({error:"User already exists, proceed with login"})
  }
  const user = await prisma.user.create({
    data:{
      name,
      email,
      password:bcrypt.hashSync(password, 10)
    }
  });
  const token = jwt.sign({userId:user.id}, process.env.JWT_SECRET!);
  return res.status(201).json({
    token,
    user:{id:user.id,email:user.email, name:user.name}
  });
})

app.post("/api/auth/login",  async (req, res)=>{
  const {email, password} = req.body;
  if(!email || !password){
    return res.status(401).json({
      error:"One of the Fields is Missing"
    });
  }
  const user = await prisma.user.findUnique({where:{email}});
  if(!user){
    return res.status(401).json({error:"User not found"});
  }
  if(!bcrypt.compareSync(password, user.password)){
    return res.status(401).json({error:"Wrong Password"});
  }
  const token = jwt.sign({userId:user.id}, process.env.JWT_SECRET!);
  return res.status(200).json({
    token,
    user:{
      id:user.id,
      email,
      name:user.name
    }
  });

})



app.listen(3000, () => {
  console.log("Server running on port 3000");
});
