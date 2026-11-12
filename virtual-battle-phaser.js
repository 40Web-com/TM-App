(() => {
  "use strict";
  if (!window.Phaser || !document.getElementById("vb-phaser-arena")) {
    console.warn("[TM Virtual Battle] Phaser did not load; using the legacy arena renderer.");
    document.querySelector(".vb-canvas-wrap")?.classList.add("legacy-mode");
    return;
  }

  const W = 960, H = 430;
  let game = null, sceneRef = null, latestMatch = null;
  const processed = new Set();
  const fighters = {};
  const walls = [];
  const effects = [];
  const keyOf = e => [e.time_sec,e.actor_id,e.target_id,e.type,e.target_hp].join(":");
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

  class VirtualBattleScene extends Phaser.Scene {
    constructor(){ super({key:"TMVirtualBattleScene"}); }

    preload(){
      const root="./assets/virtual-battle/sprites/";
      [["swordsman-idle",384,256],["swordsman-run",384,256],["swordsman-jump",384,256],["swordsman-attack",384,256],["swordsman-skill",384,256],["golem-idle",288,301],["golem-walk",288,301],["golem-attack",288,301],["golem-hurt",288,301],["golem-death",288,301]].forEach(([key,w,h])=>this.load.spritesheet(key,root+key+".webp",{frameWidth:w,frameHeight:h}));
    }
    create(){
      sceneRef = this;
      this.createFighterAnimations();
      this.drawArena();
      this.makeFighter("a","swordsman");
      this.makeFighter("b","golem");
      this.statusText = this.add.text(24,18,"TM VIRTUAL ARENA",{fontFamily:"Arial",fontSize:"12px",fontStyle:"bold",color:"#ffffff"}).setDepth(100);
      this.roundText = this.add.text(24,37,"AI COMBAT SIMULATION",{fontFamily:"Arial",fontSize:"10px",color:"#d8c4ef"}).setDepth(100);
      this.progress = this.add.rectangle(24,62,0,3,0xc58bff).setOrigin(0,0).setDepth(100);
      this.add.rectangle(0,0,W,H,0x000000,0).setOrigin(0).setDepth(200);
      this.events.on("destroy",()=>{sceneRef=null;});
    }

    drawArena(){
      const g=this.add.graphics();
      g.fillStyle(0x26394f,1);
      g.fillRect(0,0,W,H);
      g.fillStyle(0x25374a,1);g.fillRect(0,0,W,210);
      for(let i=0;i<14;i++){
        const x=i*74-8,ht=68+(i*37)%92;
        g.fillStyle(i%2?0x42566a:0x34495d,1);g.fillRect(x,210-ht,58,ht);
        g.fillStyle(0xb6d1df,.22);
        for(let r=0;r<3;r++)for(let c=0;c<3;c++)g.fillRect(x+9+c*15,220-ht+r*20,6,8);
      }
      g.fillStyle(0x586b6e,1);g.fillRect(0,218,W,212);
      g.fillStyle(0x72877f,.55);
      for(let i=0;i<8;i++){g.fillCircle(30+i*132,190+(i%3)*7,22+(i%2)*8);}
      g.lineStyle(2,0xd7e4e8,.15);
      for(let i=0;i<10;i++){g.lineBetween(i*110,218,480+(i-4.5)*125,H);}
      g.lineStyle(2,0xffffff,.12);g.strokeRect(20,82,W-40,H-100);
      this.add.rectangle(480,405,920,3,0xd5e0e7,.25);
      this.makeCrate(82,300,74,55);this.makeCrate(192,322,58,38);
      this.makeCrate(774,295,82,62);this.makeCrate(875,323,52,38);
      this.makeCrate(442,272,82,44);
      for(let i=0;i<24;i++){
        const dot=this.add.circle((i*137)%W,(i*71)%H,1+(i%3)*.5,i%2?0xe6a8ff:0x9adfff,.32);
        this.tweens.add({targets:dot,y:dot.y-24,duration:2800+(i%5)*400,repeat:-1,yoyo:true,ease:"Sine.easeInOut"});
      }
    }

    makeCrate(x,y,w,h){
      const c=this.add.container(x,y);
      const body=this.add.rectangle(0,0,w,h,0x526678,1).setStrokeStyle(2,0xb9cbd4,.8);
      const slash=this.add.graphics();slash.lineStyle(3,0x293c4d,.8);slash.lineBetween(-w/2,-h/2,w/2,h/2);slash.lineBetween(w/2,-h/2,-w/2,h/2);
      c.add([body,slash]);c.setDepth(y);
    }

    part(container,draw,x,y){
      const g=this.add.graphics();draw(g);g.setPosition(x||0,y||0);container.add(g);return g;
    }

    createFighterAnimations(){
      const defs=[["swordsman-idle",35,9,-1],["swordsman-run",9,12,-1],["swordsman-jump",21,14,0],["swordsman-attack",38,16,0],["swordsman-skill",25,16,0],["golem-idle",21,5,-1],["golem-walk",20,10,-1],["golem-attack",28,15,0],["golem-hurt",8,15,0],["golem-death",24,15,0]];
      defs.forEach(([key,count,fps,repeat])=>{if(this.textures.exists(key)&&!this.anims.exists(key))this.anims.create({key,frames:this.anims.generateFrameNumbers(key,{start:0,end:count-1}),frameRate:fps,repeat});});
    }
    makeFighter(id,kind){
      const root=this.add.container(id==="a"?120:840,348).setDepth(350);
      const shadow=this.add.ellipse(0,5,kind==="golem"?94:68,18,0x07111d,.42);
      const texture=kind+"-idle";
      let sprite;
      if(this.textures.exists(texture)){
        sprite=this.add.sprite(0,0,texture,0);
        sprite.setOrigin(kind==="golem"?149/288:168/384,kind==="golem"?271/301:236/256);
        sprite.setScale(kind==="golem"?.62:.72);
        if(this.anims.exists(texture))sprite.play(texture);
      }else{
        const fallback=this.add.graphics();
        fallback.fillStyle(kind==="golem"?0x77836b:0x8a4ce0,1);fallback.fillCircle(0,-55,kind==="golem"?43:32);
        fallback.fillStyle(0xf5d7b0,1);fallback.fillCircle(0,-100,23);
        fallback.generateTexture("fallback-"+kind,100,130);fallback.destroy();
        sprite=this.add.image(0,-55,"fallback-"+kind);
      }
      root.add([shadow,sprite]);
      fighters[id]={root,shadow,sprite,kind,hiddenUntil:0,jumpOffset:0,dodgeOffset:0,animKey:kind+"-idle"};
    }
    playFighter(f,key){
      if(!f||!f.sprite||!this.anims.exists(key)||f.animKey===key)return;
      f.animKey=key;f.sprite.play(key,true);
      if(!key.endsWith("-idle")&&!key.endsWith("-run")&&!key.endsWith("-walk")){
        f.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE,()=>{f.animKey="";});
      }
    }
    getElapsed(m){
      if(m.status==="completed")return 75;
      const start=Date.parse(m.scheduled_start_at||"");
      return Number.isFinite(start)?clamp((Date.now()-start)/1000,0,75):Number(m.elapsed_sec||0);
    }

    positionAt(m,id,t){
      const samples=[];
      (m.events||[]).forEach(e=>{
        if(e.actor_id===id && Number.isFinite(Number(e.actor_x)))samples.push({t:Number(e.time_sec),x:Number(e.actor_x),y:Number(e.actor_y)||0});
      });
      samples.sort((a,b)=>a.t-b.t);
      if(!samples.length)return {x:id===m.fighter_a.fighter_id?120:840,y:0,moving:false};
      let prev=samples[0],next=null;
      for(const p of samples){if(p.t<=t)prev=p;else{next=p;break;}}
      if(!next)return {x:prev.x,y:prev.y,moving:false};
      const f=clamp((t-prev.t)/Math.max(.01,next.t-prev.t),0,1);
      return {x:prev.x+(next.x-prev.x)*f,y:prev.y+(next.y-prev.y)*f,moving:Math.abs(next.x-prev.x)>3||Math.abs(next.y-prev.y)>3};
    }

    showEvent(e){
      const a=fighters.a,b=fighters.b;
      const actor=e.actor_id===latestMatch?.fighter_a?.fighter_id?a:b;
      const target=actor===a?b:a;
      const sx=clamp(Number(e.actor_x)||actor.root.x,35,925),tx=clamp(Number(e.target_x)||target.root.x,35,925);
      const sy=348-(Number(e.actor_y)||0)*.65,ty=348-(Number(e.target_y)||0)*.65;
      const color=e.type==="fireball"?0xff8b32:e.headshot?0xffd0ef:actor===a?0xc59aff:0xff9fcf;
      if(e.type==="gloo_wall"){
        const wx=Number(e.wall_x)||((sx+tx)/2);
        const wall=this.add.container(wx,300).setDepth(720);
        const shield=this.add.rectangle(0,0,24,116,0x75dfff,.42).setStrokeStyle(3,0xe0fbff,1);
        const shine=this.add.rectangle(0,0,6,104,0xffffff,.38);
        wall.add([shield,shine]);this.tweens.add({targets:wall,alpha:0,duration:4400,delay:1100,onComplete:()=>wall.destroy()});
        walls.push(wall);return;
      }
      if(e.type==="hide"){actor.hiddenUntil=this.time.now+1350;actor.root.setAlpha(.55);return;}
      if(e.type==="jump"){actor.jumpUntil=this.time.now+650;this.playFighter(actor,actor.kind==="swordsman"?"swordsman-jump":"golem-walk");this.tweens.add({targets:actor,jumpOffset:52,duration:260,yoyo:true,ease:"Sine.easeOut",onComplete:()=>{actor.jumpOffset=0;}});return;}
      if(e.type==="dodge"){
        const dir=actor===a?1:-1;
        this.tweens.add({targets:actor,dodgeOffset:dir*58,duration:150,yoyo:true,ease:"Quad.easeOut",onComplete:()=>{actor.dodgeOffset=0;}});
        this.floatLabel("DODGE!",actor.root.x,actor.root.y-120,0x8ceaff);return;
      }
      if(e.type==="fireball"||e.type==="grenade"){
        const orb=this.add.circle(sx,sy-38,e.type==="fireball"?10:7,e.type==="fireball"?0xff8a27:0xffd15d,1).setDepth(500);
        orb.setStrokeStyle(3,0xffe5a5,.9);
        this.tweens.add({targets:orb,x:tx,y:ty-38,duration:e.type==="fireball"?300:620,ease:"Quad.easeIn",onComplete:()=>{
          const blast=this.add.circle(tx,ty-32,e.type==="fireball"?12:8,0xff9a35,.5).setDepth(510);
          this.tweens.add({targets:blast,scale:5,alpha:0,duration:420,onComplete:()=>blast.destroy()});orb.destroy();
        }});return;
      }
      if(e.type==="attack"||e.type==="melee"||e.type==="hit")this.playFighter(actor,actor.kind+"-attack");
      if(e.type==="skill"&&actor.kind==="swordsman")this.playFighter(actor,"swordsman-skill");
      if(e.type==="headshot"&&actor.kind==="golem")this.playFighter(actor,"golem-hurt");
      if(e.type==="hit"||e.type==="headshot"||e.type==="melee"){
        const flash=this.add.circle(tx,ty-56,e.headshot?12:8,color,.8).setDepth(520);
        this.tweens.add({targets:flash,scale:2.8,alpha:0,duration:260,onComplete:()=>flash.destroy()});
        if(e.headshot)this.floatLabel("HEADSHOT",tx,ty-118,0xffb9e5);
      }
      if(e.type==="miss"||e.type==="hit"||e.type==="headshot"){
        const shot=this.add.graphics().setDepth(490);shot.lineStyle(e.headshot?3:2,color,.8);shot.lineBetween(sx,sy-65,tx,ty-65);
        this.tweens.add({targets:shot,alpha:0,duration:220,onComplete:()=>shot.destroy()});
      }
      if(e.type==="elimination")this.floatLabel("KNOCKOUT",tx,ty-125,0xffd1e7);
      if(e.type==="reload")this.floatLabel("RELOAD",sx,sy-120,0xd6e5ff);
      if(e.type==="slide")this.floatLabel("SLIDE",sx,sy-105,0xa9eaff);
      if(e.type==="flank")this.floatLabel("FLANK",sx,sy-105,0xe2b5ff);
      if(e.type==="grenade")this.floatLabel("GRENADE",sx,sy-105,0xffd47a);
    }

    floatLabel(label,x,y,color){
      const text=this.add.text(x,y,label,{fontFamily:"Arial",fontSize:"13px",fontStyle:"bold",color:"#"+color.toString(16).padStart(6,"0"),stroke:"#111827",strokeThickness:3}).setOrigin(.5).setDepth(700);
      this.tweens.add({targets:text,y:y-34,alpha:0,duration:780,onComplete:()=>text.destroy()});
    }

    sync(m){
      if(!m||!m.fighter_a||!m.fighter_b)return;
      if(latestMatch?.id!==m.id){latestMatch=m;processed.clear();Object.keys(fighters).forEach(k=>{fighters[k].root.setPosition(k==="a"?120:840,348);});}
      latestMatch=m;
      const t=this.getElapsed(m),a=fighters.a,b=fighters.b;
      const pa=this.positionAt(m,m.fighter_a.fighter_id,t),pb=this.positionAt(m,m.fighter_b.fighter_id,t);
      const setPos=(f,p)=>{
        const old=f.root.x;f.root.x=p.x+(f.dodgeOffset||0);f.root.y=348-p.y*.65-(f.jumpOffset||0);f.root.setScale(1,this.time.now < f.hiddenUntil ? 0.78 : 1);
        const moving=p.moving||Math.abs(p.x-old)>1.5;
        const idle=f.kind+"-idle",walk=f.kind==="swordsman"?"swordsman-run":"golem-walk";
        if(!f.animKey||f.animKey===idle||f.animKey===walk)this.playFighter(f,moving?walk:idle);
        f.shadow.scaleX=moving?1.12:1;
        f.root.setDepth(350+f.root.y);
        if(this.time.now>f.hiddenUntil)f.root.setAlpha(1);
      };
      setPos(a,pa);setPos(b,pb);
      const fresh=(m.events||[]).filter(e=>Number(e.time_sec)<=t+.12&&!processed.has(keyOf(e)));
      fresh.forEach(e=>{processed.add(keyOf(e));if(Number(e.time_sec)>=Math.max(0,t-1.35))this.showEvent(e);});
      this.statusText.setText(m.status==="running"?"LIVE AI BATTLE":m.status==="completed"?"BATTLE COMPLETE":"AI BATTLE PREPARING");
      this.roundText.setText("ROUND "+(m.status==="completed"?3:Math.min(3,Math.floor(t/25)+1))+" / 3   ·   "+Math.floor(t)+"s");
      this.progress.width=912*(t/75);
      if(m.status==="completed"&&this.winnerForId!==m.id){
        this.winnerForId=m.id;
        const winner=m.result?.winner_id===m.fighter_a.fighter_id?m.fighter_a.display_name:m.fighter_b.display_name;
        const veil=this.add.rectangle(W/2,H/2,W,H,0x080d19,.72).setDepth(900);
        const label=this.add.text(W/2,H/2,winner.toUpperCase()+" WINS",{fontFamily:"Arial",fontSize:"34px",fontStyle:"bold",color:"#ffffff",stroke:"#27133d",strokeThickness:5}).setOrigin(.5).setDepth(901);
        this.time.delayedCall(4200,()=>{veil.destroy();label.destroy();});
      }
    }

    update(){
      if(latestMatch)this.sync(latestMatch);
    }
  }

  function mount(){
    if(game)return;
    const config={
      type:Phaser.AUTO,
      parent:"vb-phaser-arena",
      width:W,height:H,
      backgroundColor:"#1a2840",
      antialias:true,
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
      render:{antialias:true,pixelArt:false},
      scene:[VirtualBattleScene]
    };
    game=new Phaser.Game(config);
  }

  window.TMVBPhaser={
    render(match){if(!game)mount();latestMatch=match;if(sceneRef&&match)sceneRef.sync(match);},
    ready(){return Boolean(game&&sceneRef);}
  };
  mount();
})();
