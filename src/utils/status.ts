export function getStatus(launch:any, totalPurchased: number){
    if(totalPurchased >= launch.totalSupply) return "SOLD_OUT";
    if (new Date() < launch.startsAt) return "UPCOMING";
    if (new Date() > launch.endsAt) return "ENDED";
    else return "ACTIVE";
}