// Builds src/docs/banner.webp from background.png and one card per season. Run from the repo root: node src/docs/banner/make-banner.cjs
const {join}=require("path");const sharp=require("../../node_modules/sharp");
const bg=join(__dirname,"background.png");
const cards=["season-1/cards/sir-clankalot.png","season-2/cards/dumpling.png","season-3/cards/redgale.png","season-4/cards/sister-of-the-lake.png","season-5/cards/big-bertha-the-barn-crusher.png","season-6/cards/grand-gateau-cthulhu.png","season-7/cards/sir-purrcival.png","season-8/cards/sergeant-major-bulldozer.png"];
const W=1792,H=768,cw=256,ch=384;
const angles=[-16,-11.5,-7,-2.5,2.5,7,11.5,16],xs=[796,910,1024,1138,1252,1366,1480,1594],ys=[418,396,378,366,366,378,396,418];
(async()=>{const layers=[];
for(let i=0;i<cards.length;i++){
 const mask=Buffer.from(`<svg width="${cw}" height="${ch}"><rect width="${cw}" height="${ch}" rx="14"/></svg>`);
 const card=await sharp(cards[i]).resize(cw,ch).ensureAlpha().composite([{input:mask,blend:"dest-in"}]).png().toBuffer();
 const pad=40;
 const full=await sharp({create:{width:cw+2*pad,height:ch+2*pad,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:Buffer.from(`<svg width="${cw+2*pad}" height="${ch+2*pad}"><rect x="${pad}" y="${pad+10}" width="${cw}" height="${ch}" rx="14" fill="#000" fill-opacity=".8"/></svg>`),blend:"over"}]).blur(14).png().toBuffer();
 const withCard=await sharp(full).composite([{input:card,left:pad,top:pad}]).png().toBuffer();
 const rot=await sharp(withCard).rotate(angles[i],{background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 const m=await sharp(rot).metadata();
 layers.push({input:rot,left:Math.round(xs[i]-m.width/2),top:Math.round(ys[i]-m.height/2)});
}
const text=`<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".42" stop-color="#000" stop-opacity=".35"/><stop offset=".6" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>
<g font-family="Arial, sans-serif"><text x="70" y="300" font-size="76" font-weight="bold" fill="#fff3d6">Trading Cards</text>
<text x="72" y="370" font-size="34" fill="#f2d98f">Free AI-generated card sets</text>
<text x="72" y="418" font-size="34" fill="#f2d98f">with images and JSON data</text>
<text x="72" y="500" font-size="28" fill="#e8e2d0">Test data for apps, games and demos</text>
<text x="72" y="542" font-size="28" fill="#e8e2d0">8 sets · 310 cards · CC0</text></g></svg>`;
await sharp(bg).resize(W,H).composite([{input:Buffer.from(text)},...layers]).webp({quality:85}).toFile("src/docs/banner.webp");
})();
