import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('공유 미리보기는 공개 HTTPS 이미지 URL과 최신 동행 소개를 제공한다', async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const origin=(process.env.SITE_URL||process.env.CF_PAGES_URL||'https://pyeonhanga.kichan21013.workers.dev').replace(/\/$/,'');
 const meta=key=>html.match(new RegExp('<meta property="'+key+'" content="([^"]+)"'))?.[1];
 assert.equal(meta('og:url'),origin+'/');
 assert.equal(meta('og:image'),origin+'/assets/nagachi-share-v49.jpg');
 assert.equal(meta('og:image:type'),'image/jpeg');
 assert.equal(meta('og:image:width'),'1200');
 assert.equal(meta('og:image:height'),'630');
 assert.equal(meta('og:title'),'나가치 — 가고 싶은 곳, 함께할 사람');
 assert.match(meta('og:description'),/나가치가 함께할 소모임을 직접 기획해요/);
 assert.match(html,/noindex,nofollow/);
 const img=await readFile(new URL('../dist/assets/nagachi-share-v49.jpg',import.meta.url));
 assert.equal(img.readUInt16BE(0),0xffd8,'JPEG signature');
 // JPEG frame segment confirms the static image's actual dimensions.
 let offset=2,frame=null;
 while(offset+4<img.length && img[offset]===0xff){
   const marker=img[offset+1],length=img.readUInt16BE(offset+2);
   if([0xc0,0xc1,0xc2].includes(marker)){frame=[img.readUInt16BE(offset+7),img.readUInt16BE(offset+5)];break;}
   if(length<2)break;
   offset+=2+length;
 }
 assert.deepEqual(frame,[1200,630]);
 assert.ok(img.length<300000,'가벼운 공유용 사진');
});
