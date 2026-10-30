// Recreate the pre-161 saved tree mask before fixture roads/buildings are added.
// Keep historical world/geometry hashes unchanged when new-world art evolves.
export function legacyForest(w){
 delete w.forest;let seed=w.seed;
 const random=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 for(const t of w.tiles){t.tree=t.ground==='land'&&random()<.16;t.tree&&= !t.type;random();}
 return w;
}
