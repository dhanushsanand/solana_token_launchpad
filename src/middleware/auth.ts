import {Request, Response, NextFunction} from "express";
import jwt from "jsonwebtoken";


export async function authMiddleware(req: Request, res: Response, next: NextFunction){
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.startsWith("Bearer ")){
    return res.status(401).json({error:"No token provided"});
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {userId:number};
    (req as any).userId = decoded.userId;
  } catch (error) {
    return res.status(401).json(error);
  }
  next();
}