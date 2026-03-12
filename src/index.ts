import express, { response } from "express";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware/auth";
import { getStatus } from "./utils/status";

const app = express();
app.use(express.json());

// TODO: GET /api/health -- done
// TODO: POST /api/auth/register -- done
// TODO: POST /api/auth/login -- done
// TODO: POST /api/launches (with tiers?, vesting?) -- done
// TODO: GET /api/launches (?page, ?limit, ?status) -- done
// TODO: GET /api/launches/:id (with computed status) -- done
// TODO: PUT /api/launches/:id -- done
// TODO: POST /api/launches/:id/whitelist --done
// TODO: GET /api/launches/:id/whitelist -- done
// TODO: DELETE /api/launches/:id/whitelist/:address --done
// TODO: POST /api/launches/:id/referrals --done
// TODO: GET /api/launches/:id/referrals --done
// TODO: POST /api/launches/:id/purchase (with referralCode?, tier pricing, sybil protection) --done
// TODO: GET /api/launches/:id/purchases --done
// TODO: GET /api/launches/:id/vesting?walletAddress= 

app.get("/api/health", (req, res)=>{
  return res.status(200).json({status:"ok"});
});

async function existingUser(email:string) {
  return await prisma.user.findUnique({where:{email}});
};

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
});

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

});

app.post("/api/launches", authMiddleware, async (req, res)=>{
  const {name, symbol, totalSupply, pricePerToken, startsAt, endsAt, maxPerWallet, description, tiers, vesting} = req.body;
  if(!name || !symbol || !totalSupply || !pricePerToken || !startsAt || !endsAt || !maxPerWallet){
    return res.status(400).json({error:"One or more values Missing"});
  }
  const launch = await prisma.launch.create({
    data:{
      name,
      symbol,
      creatorId:(req as any).userId,
      totalSupply,
      pricePerToken,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      maxPerWallet,
      description,
      tiers: tiers ? {create:tiers}:undefined,
      vesting: vesting ? {create:vesting}:undefined
    },
    include: {tiers:true, vesting:true}
  });
  return res.status(201).json({
    launch,
    status:getStatus(launch, 0)
  });
});

app.get("/api/launches", async (req, res)=>{
  const page = parseInt((req.query.page as string) || "1");
  const limit = parseInt((req.query.limit as string) || "10");
  const status = req.query.status;
  const launches = await prisma.launch.findMany({
    take:limit,
    skip:(page-1) * limit,
    include:{tiers:true, vesting:true, purchases:true}
  });
  const launchesWithStatus = launches.map((launch:any) => {
    const totalPurchased = launch.purchases.reduce((sum:number, p:any) => sum + p.amount, 0);
    return {...launch, status:getStatus(launch, totalPurchased)};
  });
  const totalLaunches = await prisma.launch.count();
  const filtered = status? launchesWithStatus.filter(launch => launch.status === status) : launchesWithStatus;
  return res.status(200).json({
    launches:filtered,
    total:totalLaunches,
    page,
    limit
  });
});

app.get("/api/launches/:id", async (req, res)=>{
  const launchId = parseInt(req.params.id);
  const launch = await prisma.launch.findUnique({
    where:{id:launchId},
    include:{tiers:true, vesting:true,purchases:true}
  });
  if(!launch){
    return res.status(404).json({
      error:"Launch Not found"
    });
  }
  const totalPurchased = launch.purchases.reduce((sum:number, p:any) => sum + p.amount, 0);
  return res.status(200).json({
    ...launch, status:getStatus(launch, totalPurchased)
  });
});

app.put("/api/launches/:id", authMiddleware, async (req, res) => {
  const launchId = parseInt(req.params.id);
  const userId = (req as any).userId;
  const launch = await prisma.launch.findUnique({
    where:{id:launchId},
    include:{purchases:true}
  });
  if(!launch) return res.status(404).json({error:"Launch Not found"});
  if(launch.creatorId !== userId) return res.status(403).json({error:"Unauthorized access"});
  try {
    const updatedLaunch = await prisma.launch.update({
    where:{id:launchId},
    data:req.body,
    include:{purchases:true}
  })
  const totalPurchased = updatedLaunch.purchases.reduce((sum:any, p:any)=> sum + p.amount,0);
  return res.status(200).json({...updatedLaunch, status:getStatus(updatedLaunch, totalPurchased)});
  } catch (error) {
    return res.status(500).json({error:"Unexpected error"});
  }
});

app.post("/api/launches/:id/whitelist", authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const launchId = parseInt(req.params.id);
  const addresses = req.body.addresses;

  const launch = await prisma.launch.findUnique({
    where:{id:launchId}
  });
  if(!launch) return res.status(404).json({error:"Launch Not found"});
  if(launch.creatorId !== userId) return res.status(403).json({error:"Only Launch creator can add Whitelist entries"});
  const added = await prisma.whitelistEntry.createMany({
    data:addresses.map((addr:string)=>({launchId, address:addr})),
    skipDuplicates:true
  })
  const whiteListedAddressCount = await prisma.whitelistEntry.count({where:{launchId}});
  return res.status(200).json({
    added:added.count,
    total:whiteListedAddressCount
  });
});

app.get("/api/launches/:id/whitelist", authMiddleware, async (req, res)=>{
  const launchId = parseInt(req.params.id);
  const userId = (req as any).userId;
  const launch = await prisma.launch.findUnique({where:{id:launchId}});
  const entries = await prisma.whitelistEntry.findMany({
    where:{launchId},
  });
  if(!launch) return res.status(404).json({error:"Launch not found"});
  if(launch.creatorId !== userId) return res.status(403).json({error:"Unauthorized Access"});
  const addresses = entries.map((entry:any) => (entry.address));
  return res.status(200).json({
    addresses,
    total:addresses.length
  });
});

app.delete("/api/launches/:id/whitelist/:address", authMiddleware, async (req, res)=>{
  const userId = (req as any).userId;
  const launchId = parseInt(req.params.id);
  const address = req.params.address;

  const launch = await prisma.launch.findUnique({where:{id:launchId}});
  if(!launch) return res.status(404).json({error:`Launch Not found for Id ${launchId}`});
  if(launch.creatorId !== userId) return res.status(403).json({error:"Unauthorized Access"});
  const entry = await prisma.whitelistEntry.findUnique({
    where:{launchId_address:{launchId, address}}
  });
  if(!entry) return res.status(404).json({error:"Whitelist entry not found"});
  await prisma.whitelistEntry.delete({
    where:{launchId_address:{launchId, address}}
  });
  return res.status(200).json({removed:true});
});

app.post("/api/launches/:id/referrals", authMiddleware, async (req, res)=>{
  const userId = (req as any).userId;
  const {code, discountPercent, maxUses} = req.body;
  const launchId = parseInt(req.params.id);
  const launch = await prisma.launch.findUnique({where:{id:launchId}});
  if(!launch) return res.status(404).json({error:`Launch Not found for Id ${launchId}`});
  if(launch.creatorId !== userId) return res.status(403).json({error:"Unauthorized Access"});
  try {
    const referral = await prisma.referralCode.create({
      data:{
        code,
        discountPercent,
        maxUses,
        usedCount:0,
        launchId
      }
    });
    return res.status(201).json({
      id:referral.id,
      code:referral.code,
      discountPercent:referral.discountPercent,
      maxUses:referral.maxUses,
      usedCount:referral.usedCount
    });
  } catch (error) {
    return res.status(409).json({error:"Code already exists"});
  }
  
});

app.get("/api/launches/:id/referrals", authMiddleware, async (req, res)=>{
  const userId = (req as any).userId;
  const launchId = parseInt(req.params.id);
  const launch = await prisma.launch.findUnique({where:{id:launchId},include:{referralCode:true}});
  if(!launch) return res.status(404).json({error:"Launch Not found"});
  if(launch.creatorId !== userId) return res.status(403).json({error:"Unauthorized Access"});
  return res.status(200).json({
    referralCodes:launch.referralCode
  });
});

app.post("/api/launches/:id/purchase", authMiddleware, async (req, res)=>{
  const launchId = parseInt(req.params.id);
  const {walletAddress, amount, txSignature, referralCode} = req.body;
  const userId = (req as any).userId;

  const launch = await prisma.launch.findUnique({
    where:{id:launchId},
    include:{tiers:true, vesting:true, purchases:true, whitelist:true}
  });
  if(!launch) return res.status(404).json({error:"Launch Not found"});
  const totalPurchased = launch.purchases.reduce((sum:number, p:any)=> (sum + p.amount),0);
  const status = getStatus(launch, totalPurchased);
  if(status !== "ACTIVE") return res.status(400).json({error:"Launch is not Active"});
  if(launch.whitelist.length != 0 && !launch.whitelist.find((w:any)=> w.address === walletAddress)) return res.status(400).json({error:"Wallet address not whitelisted"});
  const transaction = await prisma.purchase.findUnique({where:{txSignature}});
  if(transaction) return res.status(400).json({error:"Purchase Transaction already exists"});
  const purchases = await prisma.purchase.findMany({where:{userId, launchId}});
  const existingAmount = purchases.reduce((sum:number, p:any)=> sum+p.amount, 0);
  if(existingAmount + amount > launch.maxPerWallet) return res.status(400).json({error:"Purchase will go beyond max allowed per wallet"});
  if(totalPurchased + amount > launch.totalSupply) return res.status(400).json({error:"Purchase will go beyond total Supply"});
  const tiers = launch.tiers;
  let remaining = amount;
  let totalCost = 0;
  if(tiers.length > 0){
    tiers.sort((a: any, b: any) => a.minAmount - b.minAmount);
  
    for(const tier of tiers){
      const tierCapacity = tier.maxAmount - tier.minAmount;
      const tokenThisTier = Math.min(tierCapacity, remaining);
      totalCost += tokenThisTier * tier.pricePerToken;
      remaining -= tokenThisTier;
      if(remaining <= 0) break;
    }
    if(remaining > 0){
      totalCost += remaining * launch.pricePerToken;
    }
  }
  else{
    totalCost = amount * launch.pricePerToken;
  }
  if(referralCode){
    const referral = await prisma.referralCode.findUnique({where:{launchId_code:{launchId, code:referralCode}}});
  if(!referral) return res.status(400).json({error:"Referral Code invalid"});
  if(referral.usedCount >= referral.maxUses) return res.status(400).json({error:"Referral Code max usage reached"});
  totalCost = (totalCost) * (1 - referral.discountPercent/100);
  await prisma.referralCode.update({
    where:{id:referral.id},
    data:{
      usedCount:{increment:1}
    }
  });
  }
  const purchase = await prisma.purchase.create({
    data:{
      walletAddress,
      amount,
      totalCost,
      txSignature,
      launchId,
      userId
    }
  });

  return res.status(201).json({
    walletAddress:purchase.walletAddress,
    amount:purchase.amount,
    totalCost:purchase.totalCost,
    time:purchase.createdAt,
    transactionSignature:purchase.txSignature,
    launchId,
    userId
  });

});

app.get("/api/launches/:id/purchases", authMiddleware, async (req, res)=>{
  const userId = (req as any).userId;
  const launchId = parseInt(req.params.id);
  const launch = await prisma.launch.findUnique({where:{id:launchId}});
  if(!launch) return res.status(404).json({error:"Launch Not found"});
  const purchases = await prisma.purchase.findMany({where:{launchId}});
  const filteredPurchases = (launch.creatorId === userId)? purchases : purchases.filter((purchase)=>(purchase.userId === userId));
  return res.status(200).json({
    total:filteredPurchases.length,
    purchases:filteredPurchases
  });
  // if(launch.creatorId === userId){
  //   if(purchases.length > 0){
  //     return res.status(200).json({
  //       userId,
  //       launchId,
  //       purchases:purchases
  //     });
  //   }
  //   return res.status(404).json({error:`Purchases not found for launchId: ${launchId}`});
  // }
  // return res.status(200).json({
  //   userId,
  //   launchId,
  //   purchase: purchases.filter((purchase)=> (purchase.userId === userId))
  // });
});

app.get("/api/launches/:id/vesting?walletAddress=ADDR", async (req, res)=>{
  const walletAddress = req.query.walletAddress;
  if(!walletAddress) return res.status(400).json({error:"Wallet Address is not Present"});
  const launchId = parseInt(req.params.id);
  const launch = await prisma.launch.findUnique({
    where:{id:launchId},
    include:{vesting:true, purchases:true}
  });
  if(!launch) return res.status(404).json({error:"Launch Not found"});
  const walletPurchases = launch.purchases.filter((purchase)=> (purchase.walletAddress === walletAddress));
  const totalPurchased = walletPurchases.reduce((sum:number, p:any)=> (sum + p.amount),0);
  if(!launch.vesting){
    return res.status(200).json({
      totalPurchased:totalPurchased,
      tgeAmount:totalPurchased,
      cliffEndsAt:null,
      vestedAmount:totalPurchased,
      lockedAmount:0,
      claimableAmount:totalPurchased
    });
  }
  else{
    const cliffDays = launch.vesting.cliffDays;
    const vestingDays = launch.vesting.vestingDays;
    const tgePercent = launch.vesting.tgePercent;

    const tgeAmount = Math.floor((totalPurchased * tgePercent)/100);
    const startsAt = launch.startsAt;
    const cliffEndsAt = startsAt.getTime() + (cliffDays * 24 * 60 * 60 * 1000);
    const vestingEndsAt = cliffEndsAt + vestingDays * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    let vestedAmount = 0;
    if(now < cliffEndsAt){
      vestedAmount = tgeAmount;
    }
    else if(now >= vestingEndsAt){
      vestedAmount = totalPurchased;
    }
    else if((cliffEndsAt <= now) &&( now < vestingEndsAt)){
      const linearVested = ((totalPurchased - tgeAmount)/vestingDays) * ((now - cliffEndsAt)/(24*60*60*1000));
      vestedAmount = tgeAmount + linearVested;
    }
    vestedAmount = Math.floor(vestedAmount);
    const lockedAmount = totalPurchased - vestedAmount;
    const claimableAmount = vestedAmount;
    return res.status(200).json({
      totalPurchased:totalPurchased,
      tgeAmount:tgeAmount,
      cliffEndsAt:new Date(cliffEndsAt).toISOString(),
      vestedAmount:vestedAmount,
      lockedAmount:lockedAmount,
      claimableAmount:claimableAmount
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
