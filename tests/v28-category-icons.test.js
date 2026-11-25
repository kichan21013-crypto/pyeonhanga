import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {POPULAR_ACTIVITIES} from '../assets/v21-popular-model.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const expected={eat:'b255628aa479544489ce1e628fcfc2fc82f6198b',outing:'24d75ff5e432ac98125a700fb1bea777d2335bb9',travel:'17919f6644cabf62857e887bb70eb576fe90b0d6',hike:'7e6492862d9ae8d8807936d492f51a0812a8ca93'};
test('v28 승인 이미지 4개가 원본 변환 결과와 일치하며 가볍게 배포된다',async()=>{
 let total=0;
 for(const [id,sha] of Object.entries(expected)){
  const b=await readFile(new URL('../assets/v28-'+id+'.webp',import.meta.url));
  total+=b.length;
  assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha);
  const built=await readFile(new URL('../dist/assets/v28-'+id+'.webp',import.meta.url));
  assert.deepEqual(built,b);
 }
 assert.ok(total<15000);
});
test('v28 상단 버튼과 기존 동행 탐색을 연결하고 전 화면에 통일된 아이콘 사용',async()=>{
 const home=await read('assets/v12-direct-home.js'),core=await read('scripts/build-core.js'),css=await read('assets/v21-popular-first.css');
 assert.match(home,/\['eat','맛집'\],\['outing','나들이'\],\['travel','여행'\],\['hike','산행'\]/);
 assert.match(home,/class="n28-quick-category" data-v16-invite/);
 assert.match(home,/id="n16-invites"/);
 assert.equal((home.match(/id="n16-invites"/g)||[]).length,1);
 assert.match(home,/setupTogetherJourney\(\{home,loadPlaces:loadCatalog\}\)/);
 assert.match(home,/가고 싶은 곳, 함께할 사람\./);
 assert.match(core,/v28-'\+invite\.id\+'\.webp/);
 for(const item of POPULAR_ACTIVITIES)assert.equal(item.image,'v28-'+item.invite+'.webp');
 assert.match(css,/\.n28-quick-category:focus-visible/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(await read('dist/index.html'),/v12-direct-home\.js\?v=20261125-v47/);
});
