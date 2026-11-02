// Native-sized body, anchored to a single 16 × 16 movement tile.
export function quickPlayerBounds(player){return{x:player.x*16,y:player.y*16-16,w:16,h:32};}
export function quickPlayerCells(player,map){return[player.y-1,player.y].filter(y=>y>=0&&y<map.height&&player.x>=0&&player.x<map.width).map(y=>({x:player.x,y}));}
export function drawQuickPlayer(c,p,facing={x:0,y:1}){const b=quickPlayerBounds(p);c.save();c.translate(b.x,b.y);c.imageSmoothingEnabled=false;
 c.fillStyle='#233247';c.fillRect(3,1,10,2);c.fillRect(2,3,12,5);c.fillRect(1,6,14,2);
 c.fillStyle='#edbc84';c.fillRect(4,8,8,7);c.fillRect(3,10,10,3);
 c.fillStyle='#1c283a';if(facing.y>=0){c.fillRect(facing.x<0?4:6,10,1,2);if(!facing.x)c.fillRect(10,10,1,2);}else c.fillRect(4,8,8,4);
 c.fillStyle='#3b6d90';c.fillRect(3,15,10,10);c.fillStyle='#e4e6d9';c.fillRect(4,16,8,7);
 c.fillStyle='#edbc84';c.fillRect(1,17,2,8);c.fillRect(13,17,2,8);
 c.fillStyle='#283b59';c.fillRect(4,25,3,5);c.fillRect(9,25,3,5);c.fillStyle='#182234';c.fillRect(3,30,4,2);c.fillRect(9,30,4,2);c.restore();return b;}
