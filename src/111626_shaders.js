// ---------------------------------------------------------------------------
// GLSL. Shared per-frame data lives in one std140 uniform block (binding 0);
// per-view data (camera, resolution) are ordinary uniforms.
// ---------------------------------------------------------------------------
const NB = 24;            // bone matrices
const SH0_Y = 1.4, SH1_Y = 1.8, CEIL_Y = 2.95;
const K = { PLAIN: 0, TEX: 1, BENCH: 2, FLOOR: 3, WALL: 4, BRUSH: 5, EMTEX: 6, PAPER: 7, STRIP: 8, AGAR: 9, DIGIT: 10, INK: 11, FOIL: 12, PAD: 13 };

const G_HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DShadow;
#define PI 3.14159265
layout(std140) uniform Frame {
  mat4 uShM0; mat4 uShM1;
  vec4 uKeyDir; vec4 uKeyCol;
  vec4 uTA[2]; vec4 uTB[2]; vec4 uTC[2];
  vec4 uFlame; vec4 uFlameCol;
  vec4 uAmbSky; vec4 uAmbGnd;
  vec4 uDigits; vec4 uMisc;
  mat4 uBones[${NB}];
};
`;

const VS_SCENE = G_HEAD + `
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aNrm; layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aMat; layout(location=4) in uvec4 aIdx; layout(location=5) in vec2 aUV;
uniform mat4 uVP; uniform float uBoneSel;
out vec3 vW; out vec3 vN; out vec4 vCol; out vec4 vMat; out vec2 vUV; flat out uvec2 vK;
void main(){
  mat4 M=uBones[aIdx.x];
  vec4 w=M*vec4(aPos,1.);
  vW=w.xyz; vN=mat3(M)*aNrm.xyz;
  vCol=vec4(pow(aCol.rgb,vec3(2.2)),aCol.a); vMat=aMat; vUV=aUV; vK=aIdx.yz;
  if(aIdx.y==${K.DIGIT}u) vUV.x+=uDigits[int(aMat.z*255.+.5)]*uMisc.x;
  gl_Position=uVP*w;
  if((uBoneSel==1.&&aIdx.x!=0u)||(uBoneSel==2.&&aIdx.x==0u)) gl_Position=vec4(2.,2.,2.,1.);
}`;

const G_LIGHT = `
in vec3 vW; in vec3 vN; in vec4 vCol; in vec4 vMat; in vec2 vUV; flat in uvec2 vK;
uniform vec3 uCam; uniform vec4 uRes; uniform mat4 uView;
uniform sampler2D uAtlas; uniform sampler2D uNoise; uniform sampler2D uAO; uniform sampler2D uRefl; uniform sampler2D uScene;
uniform sampler2DShadow uSh0; uniform sampler2DShadow uSh1;
out vec4 o;
float D_GGX(float nh,float a){float a2=a*a,d=nh*nh*(a2-1.)+1.;return a2/(PI*d*d+1e-6);}
float V_SJ(float nv,float nl,float a){float k=a*.5+1e-4;return .25/((nv*(1.-k)+k)*(nl*(1.-k)+k));}
vec3 specL(vec3 N,vec3 V,vec3 L,float rough,vec3 F0){
  vec3 H=normalize(V+L);float nl=max(dot(N,L),0.),nv=max(dot(N,V),1e-3),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
  float a=max(rough*rough,.003);
  return min(D_GGX(nh,a)*V_SJ(nv,nl,a),40.)*(F0+(1.-F0)*pow(1.-vh,5.))*nl;
}
float shadow0(vec3 w,vec3 n){
  vec4 p=uShM0*vec4(w+n*.009,1.); vec3 c=p.xyz*.5+.5; c.z-=.0018;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.;
  return texture(uSh0,c);
}
float shadow1(vec3 w,vec3 n){
  vec4 p=uShM1*vec4(w+n*.006,1.); vec3 c=p.xyz*.5+.5; c.z-=.002;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.||c.z<0.) return 1.;
  return texture(uSh1,c);
}
// 1 = the path from P along d (d.y>0) is not blocked by the shelf whose top is at ys
float shelfVis(vec3 P,vec3 d,float ys,float soft){
  if(d.y<1e-3||P.y>ys-.035) return 1.;
  float t=(ys-.028-P.y)/d.y; vec2 h=P.xz+d.xz*t; vec2 q=abs(h-vec2(0.,.155))-vec2(1.44,.155);
  return smoothstep(-soft,soft,max(q.x,q.y));
}
// closest point on strip i to the ray (P, r): returns vector from P
vec3 stripPt(int i,vec3 P,vec3 r){
  vec3 L0=uTA[i].xyz-P, Ld=uTB[i].xyz-uTA[i].xyz; float rl0=dot(r,L0), rld=dot(r,Ld), l0ld=dot(L0,Ld), ld2=dot(Ld,Ld);
  float t=clamp((rl0*rld-l0ld)/(ld2-rld*rld+1e-5),0.,1.); return L0+Ld*t;
}
vec3 stripNear(int i,vec3 P){
  vec3 ab=uTB[i].xyz-uTA[i].xyz; float t=clamp(dot(P-uTA[i].xyz,ab)/dot(ab,ab),0.,1.); return uTA[i].xyz+ab*t-P;
}
float stripAtt(vec3 Lp){ float d2=dot(Lp,Lp), d=sqrt(d2); return clamp(Lp.y/d*1.6,0.,1.)/(d*(d+.9)+.01); }
// analytic room: dim gradient, two ceiling panels, the two under-shelf strips; shelves occlude
vec3 envRad(vec3 P,vec3 R,float rough){
  vec3 c=mix(uAmbGnd.rgb,uAmbSky.rgb,smoothstep(-.5,.6,R.y))*1.5;
  float soft=.03+rough*.9;
  if(R.y>.02){
    float open=shelfVis(P,R,${SH0_Y.toFixed(3)},soft*.4)*shelfVis(P,R,${SH1_Y.toFixed(3)},soft*.4);
    float t=(${CEIL_Y.toFixed(2)}-P.y)/R.y; vec2 h=P.xz+R.xz*t;
    vec2 d=abs(h-vec2(-.75,1.55))-vec2(.62,.31), d2=abs(h-vec2(1.15,1.55))-vec2(.62,.31);
    float pn=smoothstep(soft,-soft*.4,max(d.x,d.y))+smoothstep(soft,-soft*.4,max(d2.x,d2.y));
    c=c*mix(.3,1.,open)+uKeyCol.rgb*2.6*pn*open/(1.+rough*5.);
  }
  for(int i=0;i<2;i++){
    vec3 Ls=stripPt(i,P,R); float pr=dot(Ls,R);
    if(pr>0.&&Ls.y>0.){
      float ang=length(Ls-R*pr)/pr, w=.014+rough*.45;
      float vis=i==1?shelfVis(P,normalize(Ls),${SH0_Y.toFixed(3)},.02):1.;
      c+=uTC[i].rgb*1.25*smoothstep(w,w*.25,ang)*vis/(1.+rough*9.);
    }
  }
  return c;
}
// diffuse irradiance (already divided by PI) from all lights, with optional wrap for translucent media
// sh: pre-filtered screen-space shadow factors (key, strip); negative = look the shadow maps up here
vec3 irr(vec3 P,vec3 N,float wrap,float ao,vec2 sh){
  vec3 e=mix(uAmbGnd.rgb,uAmbSky.rgb,N.y*.5+.5)*ao;
  float nl=(dot(N,uKeyDir.xyz)+wrap)/(1.+wrap);
  if(nl>0.) e+=uKeyCol.rgb*nl*(sh.x<0.?shadow0(P,N):sh.x)/PI;
  for(int i=0;i<2;i++){
    if(i==0?P.y>1.36:P.y<1.3) continue;
    vec3 Lp=stripNear(i,P); vec3 L=normalize(Lp); float n2=(dot(N,L)+wrap)/(1.+wrap);
    if(n2>0.){ float v=i==0?mix(1.,sh.y<0.?shadow1(P,N):sh.y,smoothstep(.2,.3,P.z)):shelfVis(P,L,${SH0_Y.toFixed(3)},.03); e+=uTC[i].rgb*stripAtt(Lp)*n2*v/PI; }
  }
  vec3 Lf=uFlame.xyz-P; float df=dot(Lf,Lf); if(df<1.) e+=uFlameCol.rgb*uFlame.w*max((dot(N,normalize(Lf))+wrap)/(1.+wrap),0.)/(df+.004)/PI;
  return e;
}
vec3 specAll(vec3 P,vec3 N,vec3 V,float rough,vec3 F0,float sh){
  vec3 c=specL(N,V,uKeyDir.xyz,rough,F0)*uKeyCol.rgb*sh;
  if(rough>.62) return c;
  vec3 r=reflect(-V,N);
  for(int i=0;i<2;i++){
    if(i==0?P.y>1.36:P.y<1.3) continue;
    vec3 Ls=stripPt(i,P,r); vec3 L=normalize(Ls);
    float v=i==0?1.:shelfVis(P,L,${SH0_Y.toFixed(3)},.03);
    c+=specL(N,V,L,max(rough,.09),F0)*uTC[i].rgb*stripAtt(Ls)*v*.13;
  }
  return c;
}
`;

const FS_OPAQUE = `
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW);
  if(abs(uRes.w-1.)<.25&&vW.y<uRes.z) discard;        // mirrored pass: keep only what is above the bench top
  vec3 alb=vCol.rgb; float rough=vCol.a, metal=vMat.x, emis=vMat.y*${EMAX}.; uint kind=vK.x;
  vec3 extra=vec3(0.); float envK=1., wrap=0.;
  if(kind==${K.TEX}u||kind==${K.PAPER}u){ alb*=texture(uAtlas,vUV).rgb; if(kind==${K.PAPER}u) wrap=.25; }
  else if(kind==${K.AGAR}u){ alb*=texture(uAtlas,vUV).rgb; wrap=.45; }
  else if(kind==${K.BENCH}u){
    float n=texture(uNoise,vW.xz*5.).r, n2=texture(uNoise,vW.xz*31.).g;
    alb*=.95+.1*n2; rough=clamp(rough+(n-.5)*.07,.05,1.);
  }
  else if(kind==${K.FLOOR}u){
    if(N.y<.5){ alb=vec3(.035,.037,.04); rough=.9; }
    else { vec2 t=vW.xz/.3048; vec2 f=abs(fract(t)-.5); float ln=smoothstep(.492,.5,max(f.x,f.y));
      float sp=texture(uNoise,vW.xz*9.).r, sp2=texture(uNoise,vW.xz*37.).b; vec2 id=floor(t);
      float tv=fract(sin(dot(id,vec2(12.9,78.2)))*43758.5);
      alb*=(.82+.3*sp2*sp+.1*tv)*(1.-ln*.45); rough=mix(.36,.47,sp); }
  }
  else if(kind==${K.WALL}u){
    if(N.z<.5){ alb=vec3(.035,.037,.04); rough=.9; }
    else { float n=texture(uNoise,vW.xy*.7).r, n2=texture(uNoise,vW.xy*17.).g; alb*=.9+.14*n+.05*n2; }
  }
  else if(kind==${K.BRUSH}u){ float n=texture(uNoise,vec2(vW.x*2.+vW.z,vW.y*60.+vW.z*40.)).r; rough=clamp(rough+(n-.5)*.22,.08,1.); alb*=.92+.16*n; }
  else if(kind==${K.EMTEX}u||kind==${K.DIGIT}u){ vec4 t=texture(uAtlas,vUV); extra=t.rgb*emis; alb=t.rgb*.04; emis=0.; }
  else if(kind==${K.STRIP}u){ float e=smoothstep(1.,.2,abs(vUV.y-.5)*2.); extra=alb*emis*(.55+.45*e); alb*=.2; emis=0.; }
  else if(kind==${K.FOIL}u){
    vec3 q=vW*13.; vec3 nz=vec3(texture(uNoise,q.xy*.02+q.z*.013).r,texture(uNoise,q.yz*.02+q.x*.011).g,texture(uNoise,q.zx*.02+q.y*.017).b)-.5;
    N=normalize(N+nz*.45); rough=max(rough,.46);
  }
  else if(kind==${K.PAD}u){ float n=texture(uNoise,vW.xz*42.).r; alb*=.93+.1*n; wrap=.2; }
  vec3 F0=mix(vec3(.04),alb,metal), dif=alb*(1.-metal);
  float nv=max(dot(N,V),1e-3);
#ifdef LOWQ
  float ao=1.; vec2 shv=vec2(-1.);
#else
  vec4 A=texture(uAO,gl_FragCoord.xy*uRes.xy); float ao=A.r; vec2 shv=A.ba;
#endif
  float sh=1.;
  vec3 col=dif*irr(vW,N,wrap,ao,shv);
  if(dot(N,uKeyDir.xyz)>0.) sh=shv.x<0.?shadow0(vW,N):shv.x;
  col+=specAll(vW,N,V,rough,F0,sh);
  vec3 Fr=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-nv,5.);
  vec3 R=reflect(-V,N);
#ifndef LOWQ
  if(kind==${K.BENCH}u){
    vec2 suv=gl_FragCoord.xy*uRes.xy; float n=texture(uNoise,vW.xz*23.).g;
    vec3 rf=textureLod(uRefl,suv+vec2(n-.5,0.)*.003,1.9+n*.6).rgb;
    col+=rf*(.045+.955*pow(1.-nv,5.))*.8; envK=0.;
  }
#endif
  if(rough<.5||metal>.5) col+=envRad(vW,R,rough)*Fr*mix(.35,1.,ao)*envK;
  else col+=mix(uAmbGnd.rgb,uAmbSky.rgb,R.y*.5+.5)*1.5*Fr*ao*envK;
  col+=dif*emis+extra;
  o=vec4(min(col,vec3(30.)),vMat.w>.5?0.:1.);    // alpha 0 marks labels stuck on glassware (see the liquid shader)
}`;

// liquids, tinted plastics and amber glass: refract the low-res opaque pre-render, absorb, scatter
const FS_LIQUID = `
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW);
  if(uRes.w>.5&&vW.y<uRes.z) discard;
  if(dot(N,V)<0.) N=-N;
  float nv=max(dot(N,V),1e-3);
  vec3 tint=max(vCol.rgb,vec3(.002)); float turb=vMat.z, dens=vMat.w*4.;
  vec3 bg;
  if(uRes.w<.5){
    vec3 nV=mat3(uView)*N; vec2 suv=gl_FragCoord.xy*uRes.xy;
    vec4 sc=texture(uScene,clamp(suv-nV.xy*(.02+.07*(1.-nv)),.002,.998));
    bg=sc.a>.5?sc.rgb:envRad(vW,refract(-V,N,.75),.5)*.8;
  } else bg=envRad(vW,refract(-V,N,.75),.35);
  vec3 trans=pow(tint,vec3(dens*(.3+.7*nv)));
  vec3 scat=tint*irr(vW,N,.7,1.,vec2(-1.))*1.25;
  vec3 col=mix(bg*trans,scat,turb);
  for(int i=0;i<2;i++){                                   // back-lit glow from the strips
    vec3 Lp=stripNear(i,vW); vec3 L=normalize(Lp);
    float v=i==0?1.:shelfVis(vW,L,${SH0_Y.toFixed(3)},.03);
    col+=sqrt(tint)*uTC[i].rgb*stripAtt(Lp)*v*(.02+.085*pow(max(dot(-L,V)*.5+.5,0.),3.))*(1.-turb*.5);
  }
  float F=.02+.98*pow(1.-nv,5.);
  col=mix(col,envRad(vW,reflect(-V,N),.06),F*.55);
  col+=specAll(vW,N,V,.12,vec3(.03),1.)*.6;
  o=vec4(min(col,vec3(30.)),1.);
}`;

// thin clear shells: rgb = reflected light (added), a = transmittance (multiplies what is behind)
const FS_GLASS = `
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(uCam-vW);
  if(abs(uRes.w-1.)<.25&&vW.y<uRes.z) discard;
  if(dot(N,V)<0.) N=-N;
  float nv=max(dot(N,V),1e-3);
  if(vK.x==${K.INK}u){ vec4 t=texture(uAtlas,vUV); o=vec4(t.rgb*vCol.rgb*irr(vW,N,.5,1.,vec2(-1.))*t.a,1.-t.a); return; }
  float rough=vCol.a, frost=vMat.z;
  float F=.04+.96*pow(1.-nv,5.);
  vec3 c=envRad(vW,reflect(-V,N),rough)*F;
  c+=specAll(vW,N,V,max(rough,.05),vec3(.04),1.);
  if(frost>.01) c+=vCol.rgb*frost*irr(vW,N,.6,1.,vec2(-1.))*.8;
  float T=(1.-F*.85)*(1.-frost*.55)*mix(1.,.93,pow(1.-nv,2.));
  o=vec4(min(c,vec3(30.)),T);
}`;

const FS_DEPTH = `#version 300 es
precision highp float;
uniform float uDither;
void main(){ if(uDither>.5){ vec2 f=floor(gl_FragCoord.xy); if(fract(f.x*.5+f.y*.25)>.2) discard; } }`;

const FS_MASK = `#version 300 es
precision highp float;
uniform vec4 uMaskCol; out vec4 o;
void main(){ o=uMaskCol; }`;

const VS_FX = G_HEAD + `
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aNrm; layout(location=2) in vec4 aCol; layout(location=3) in vec4 aMat; layout(location=5) in vec2 aUV;
uniform mat4 uVP; uniform vec3 uCam;
out vec3 vN; out vec3 vV; out vec2 vUV; out vec4 vCol;
void main(){
  vec3 p=aPos; float h=aUV.y, t=uMisc.y;
  float w=h*h*aMat.z*.0035;
  p.x+=(sin(t*17.+h*11.)+.6*sin(t*29.3+h*23.))*w; p.z+=(cos(t*14.1+h*13.)+.6*sin(t*31.7+h*19.))*w;
  p.y+=sin(t*21.)*h*h*.004*aMat.z;
  vN=aNrm.xyz; vV=uCam-p; vUV=aUV; vCol=aCol;
  gl_Position=uVP*vec4(p,1.);
}`;
const FS_FX = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vV; in vec2 vUV; in vec4 vCol; out vec4 o;
void main(){
  float e=abs(dot(normalize(vN),normalize(vV)));
  float h=vUV.y;
  float edge=mix(pow(1.-e,1.5)*1.6+.25, pow(e,1.6), vCol.a);      // a=0: hollow outer mantle, a=1: solid inner cone
  vec3 c=pow(vCol.rgb,vec3(2.2))*edge*(1.-h*h*.85)*smoothstep(0.,.08,h);
  o=vec4(c*5.,1.);
}`;

// drifting dust motes
const VS_MOTE = G_HEAD + `
layout(location=0) in vec3 aPos; layout(location=5) in vec2 aUV;
uniform mat4 uVP; uniform vec4 uRes;
out float vA;
void main(){
  float t=uMisc.y*.035+aUV.x*40.;
  vec3 p=aPos+vec3(sin(t*1.3+aUV.y*9.)*.25,sin(t+aUV.x*20.)*.18,cos(t*.9+aUV.y*14.)*.25);
  gl_Position=uVP*vec4(p,1.);
  gl_PointSize=clamp(aUV.y*8./gl_Position.w/uRes.y*.0011,1.,48.);
  vA=(.25+.75*aUV.x)*smoothstep(.6,1.6,gl_Position.w);
}`;
const FS_MOTE = `#version 300 es
precision highp float;
in float vA; out vec4 o;
void main(){ vec2 q=gl_PointCoord-.5; float d=dot(q,q)*4.; o=vec4(vec3(.55,.7,.85)*vA*smoothstep(1.,.2,d)*.5,1.); }`;

const VS_POST = `#version 300 es
out vec2 vUV;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); vUV=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
const P_HEAD = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
`;

const FS_BG = P_HEAD + `
uniform vec4 uP;
void main(){
  vec2 q=(vUV-vec2(.5,.56))*vec2(uP.x,1.); float d=length(q);
  vec3 c=mix(vec3(.030,.052,.075),vec3(.004,.007,.012),smoothstep(0.,.95,d));
  c+=vec3(.012,.02,.03)*smoothstep(.5,0.,abs(vUV.y-.42))*smoothstep(1.,.1,d);
  o=vec4(c,1.);
}`;

// low-res screen-space pass: ambient occlusion plus filtered shadow factors for both shadow-casting lights,
// all from the depth pre-pass (normals reconstructed from depth). Output: r = ao, g = view depth, b = key shadow, a = strip shadow
const FS_SSAO = G_HEAD + `
in vec2 vUV; out vec4 o;
uniform sampler2D uDepth; uniform sampler2DShadow uSh0; uniform sampler2DShadow uSh1;
uniform vec4 uProj; uniform vec4 uTex; uniform mat4 uInvView; // uProj: tanX, tanY, near, far ; uTex: 1/w, 1/h
float lz(float d){ float z=d*2.-1.; return 2.*uProj.z*uProj.w/(uProj.w+uProj.z-z*(uProj.w-uProj.z)); }
vec3 vp(vec2 uv){ float z=lz(texture(uDepth,uv).r); return vec3((uv*2.-1.)*uProj.xy*z,-z); }
void main(){
  float d0=texture(uDepth,vUV).r; if(d0>=.99999){ o=vec4(1.,uProj.w,1.,1.); return; }
  vec3 P=vp(vUV);
  vec3 N=normalize(cross(dFdx(P),dFdy(P)));
  float z=-P.z, R=.11; vec2 ruv=R/(z*uProj.xy)*.5;
  float ang=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))*6.2831853, s=0.;
  for(int i=0;i<6;i++){
    float t=(float(i)+.5)/6., a=ang+float(i)*2.39996;
    vec3 Q=vp(vUV+vec2(cos(a),sin(a))*sqrt(t)*ruv);
    vec3 v=Q-P; float vv=dot(v,v), vn=dot(v,N);
    s+=max(vn-.004-.002*z,0.)/(vv+.0006)*smoothstep(R*R*1.6,R*R*.4,vv);
  }
  float ao=clamp(1.-s*.38,0.,1.);
  vec3 W=(uInvView*vec4(P,1.)).xyz, Nw=mat3(uInvView)*N;
  float s0=1., s1=1., tx=uMisc.z;
  vec3 c=(uShM0*vec4(W+Nw*.009,1.)).xyz*.5+.5; c.z-=.0018;
  if(c.x>0.&&c.x<1.&&c.y>0.&&c.y<1.&&c.z<1.){ s0=0.; for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++) s0+=texture(uSh0,vec3(c.xy+vec2(x,y)*tx*1.3,c.z)); s0/=9.; }
  c=(uShM1*vec4(W+Nw*.006,1.)).xyz*.5+.5; c.z-=.002;
  if(c.x>0.&&c.x<1.&&c.y>0.&&c.y<1.&&c.z<1.&&c.z>0.){ vec2 t2=vec2(uMisc.w,uMisc.w*2.)*vec2(2.2,1.2); s1=0.; for(int y=0;y<2;y++)for(int x=0;x<2;x++) s1+=texture(uSh1,vec3(c.xy+(vec2(x,y)-.5)*t2,c.z)); s1*=.25; }
  o=vec4(ao*ao*.85+.15,z,s0,s1);
}`;
// depth-aware separable blur of occlusion and both shadow factors; .g carries linear view depth
const FS_AOBLUR = P_HEAD + `
uniform sampler2D uTex0; uniform vec4 uDir; // xy: step
void main(){
  vec4 c=texture(uTex0,vUV); float z0=c.g, w=.3; vec3 s=c.rba*.3;
  for(int i=1;i<=2;i++){
    for(int k=-1;k<=1;k+=2){
      vec4 t=texture(uTex0,vUV+uDir.xy*(float(i*k)*1.5)); float wt=(.3-float(i)*.08)*clamp(1.-abs(t.g-z0)*14./z0,0.,1.);
      s+=t.rba*wt; w+=wt;
    }
  }
  s/=w; o=vec4(s.x,c.g,s.y,s.z);
}`;

const FS_DOWN = P_HEAD + `
uniform sampler2D uTex0; uniform vec4 uDir; // xy: texel of source, z: threshold (first pass only)
void main(){
  vec2 t=uDir.xy;
  vec3 a=texture(uTex0,vUV+t*vec2(-1.,-1.)).rgb, b=texture(uTex0,vUV+t*vec2(1.,-1.)).rgb, c=texture(uTex0,vUV+t*vec2(-1.,1.)).rgb, d=texture(uTex0,vUV+t*vec2(1.,1.)).rgb, e=texture(uTex0,vUV).rgb;
  if(uDir.z>0.){ // soft threshold + luma weighting to keep small bright sources stable
    vec3 s=vec3(0.); float w=0.;
    vec3 k[5]=vec3[5](a,b,c,d,e);
    for(int i=0;i<5;i++){ float l=max(k[i].r,max(k[i].g,k[i].b)); float wt=1./(1.+l*.5); float m=max(l-uDir.z,0.); s+=k[i]*(m/(l+1e-4))*wt; w+=wt; }
    o=vec4(s/w,1.);
  } else o=vec4((a+b+c+d)*.2+e*.2,1.);
}`;
const FS_UP = P_HEAD + `
uniform sampler2D uTex0; uniform vec4 uDir;
void main(){
  vec2 t=uDir.xy*.75; vec3 s=texture(uTex0,vUV).rgb*4.;
  s+=(texture(uTex0,vUV+t).rgb+texture(uTex0,vUV-t).rgb+texture(uTex0,vUV+vec2(t.x,-t.y)).rgb+texture(uTex0,vUV+vec2(-t.x,t.y)).rgb)*3.;
  o=vec4(s/16.*uDir.z,1.);
}`;
const FS_MBLUR = P_HEAD + `
uniform sampler2D uTex0; uniform vec4 uDir;
void main(){
  vec4 s=texture(uTex0,vUV)*.2;
  for(int i=1;i<=4;i++){ float w=.2-float(i)*.04+.06; vec2 d=uDir.xy*float(i)*3.2; s+=(texture(uTex0,vUV+d)+texture(uTex0,vUV-d))*w*.5; }
  o=s;
}`;

const FS_COMP = P_HEAD + `
uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uMask; uniform sampler2D uMaskB;
uniform vec4 uP; // exposure, bloom, glow, time
uniform vec4 uQ; // fade, vignette, _, _
vec3 tone(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){
  vec3 c=texture(uScene,vUV).rgb+texture(uBloom,vUV).rgb*uP.y;
  vec4 mb=texture(uMaskB,vUV), ms=texture(uMask,vUV);
  float oa=clamp(mb.a*(1.-clamp(ms.a*8.,0.,1.))*1.7*uP.z,0.,1.); oa*=oa*(3.-2.*oa); vec3 oc=mb.rgb/max(mb.a,.02);
  c=mix(c,oc*1.1,oa*.6)+oc*oa*.45+ms.rgb*.05*uP.z;
  vec2 q=vUV-.5; c*=1.-dot(q,q)*uQ.y;
  c=tone(c*uP.x);
  c=pow(c,vec3(1./2.2));
  float l=dot(c,vec3(.3,.59,.11)); c=mix(vec3(l),c,1.06);
  c*=uQ.x;
  float n=fract(sin(dot(gl_FragCoord.xy+uP.w,vec2(12.9898,78.233)))*43758.5453);
  o=vec4(c+(n-.5)/170.,1.);
}`;
