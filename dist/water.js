import {waterHeightTexture,writeWaterHeights} from './water-depth.js?v=139';
import * as THREE from './vendor/three.module.js';
import {waterRippleTexture} from './water-ripples.js?v=139';
import {Reflector} from './vendor/Reflector.js';
export function reflectedWater(view,ground,far){
 const nearHeight=waterHeightTexture(ground),farHeight=waterHeightTexture(far),ripples=waterRippleTexture();
 const shader={name:'Borough river',uniforms:{...THREE.UniformsLib.fog,ripples:{value:ripples},color:{value:new THREE.Color('#153646')},shallowColor:{value:new THREE.Color('#577568')},nearHeight:{value:nearHeight},farHeight:{value:farHeight},heightSizes:{value:new THREE.Vector2(nearHeight.image.width,farHeight.image.width)},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0},night:{value:0},reflectionEnabled:{value:1}},vertexShader:`
 #include <fog_pars_vertex>
 uniform mat4 textureMatrix;varying vec4 projected;varying vec3 world;varying vec3 eye;
 void main(){projected=textureMatrix*vec4(position,1.);world=(modelMatrix*vec4(position,1.)).xyz;eye=cameraPosition-world;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }
 `,fragmentShader:`
 #include <fog_pars_fragment>
 uniform sampler2D tDiffuse,nearHeight,farHeight,ripples;uniform vec3 color,shallowColor;uniform vec2 heightSizes;uniform float time,night,reflectionEnabled;varying vec4 projected;varying vec3 world;varying vec3 eye;
 float bedHeight(vec2 p){
  bool near=abs(p.x)<=96.&&abs(p.y)<=96.;float size=near?heightSizes.x:heightSizes.y,extent=near?96.:550.;
  vec2 uv=clamp((p/(extent*2.)+.5)*(size-1.)/size+.5/size,vec2(.5/size),vec2(1.-.5/size));
  vec2 encodedHeight=near?texture2D(nearHeight,uv).rg:texture2D(farHeight,uv).rg;
  return dot(encodedHeight,vec2(255.,255./256.))-64.;
 }
 void main(){
 vec2 p=world.xz;float depth=max(0.,-.1-bedHeight(p));vec3 v=normalize(eye);
 // Different scales, directions and drift rates break long repeating wavefronts.
 mat2 rotation=mat2(.8,-.6,.6,.8);
 vec3 a=texture2D(ripples,p*.13+time*vec2(.007,-.004)).rgb;
 vec3 b=texture2D(ripples,rotation*p*.31+time*vec2(-.006,.009)).rgb;
 vec2 gradient=(a.rg*2.-1.)*.68+transpose(rotation)*(b.rg*2.-1.)*.32;
 float bankDamping=mix(.3,1.,smoothstep(.02,.55,depth));
 vec3 n=normalize(vec3(gradient.x*.42*bankDamping,1.,gradient.y*.42*bankDamping));
 float facing=max(dot(n,v),0.),fres=.02+.98*pow(1.-facing,5.);
 // Looking through a longer water column absorbs more light, exposing a narrow
 // green-brown shallow margin rather than a bright rim around the whole coast.
 float transmission=exp(-depth*1.8/max(.25,v.y));
 vec3 body=mix(color,shallowColor,transmission)*mix(1.,.2,night);
 body*=.97+a.b*.06*transmission;
 vec2 reflectedUv=projected.xy/projected.w+n.xz*.035/max(1.,projected.w*.03);
 vec2 edge=smoothstep(vec2(0.),vec2(.035),reflectedUv)*(1.-smoothstep(vec2(.965),vec2(1.),reflectedUv));
 vec3 sky=mix(vec3(.23,.32,.4),vec3(.018,.035,.055),night);
 float reflectionWeight=reflectionEnabled*edge.x*edge.y*step(0.,projected.w);
 vec3 reflection=sky;
 if(reflectionWeight>0.)reflection=mix(sky,texture2D(tDiffuse,clamp(reflectedUv,vec2(.001),vec2(.999))).rgb,reflectionWeight);
 vec3 c=mix(body,reflection,fres);
 vec3 halfDirection=normalize(normalize(vec3(-.65,.95,.7))+v);
 float highlight=pow(max(dot(n,halfDirection),0.),160.);
 c+=vec3(1.,.93,.78)*highlight*.35*(1.-night);
 float wash=.045+a.b*.08,shoreWidth=max(.025,fwidth(depth)*1.5);
 float foam=(1.-smoothstep(wash, wash+shoreWidth,depth))*smoothstep(.004,.035,depth)*smoothstep(.53,.75,a.b*b.b+.22);
 c=mix(c,vec3(.44,.5,.44)*mix(1.,.16,night),foam*.35);
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
 }

 `};
 const water=new Reflector(new THREE.PlaneGeometry(1100,1100),{color:0x153646,textureWidth:384,textureHeight:384,multisample:0,clipBias:.002,shader});
 water.material.fog=true;water.material.uniforms.ripples.value=ripples;
 water.material.uniforms.nearHeight.value=nearHeight;water.material.uniforms.farHeight.value=farHeight;
 water.rotation.x=-Math.PI/2;water.position.y=-.1;
 const render=water.onBeforeRender;let last=-1;
 water.onBeforeRender=(renderer,scene,camera)=>{const t=performance.now();if(view.reflectionsEnabled===false||view.detailEnabled===false||t-last<250)return;last=t;render(renderer,scene,camera);};
 water.userData.refreshDepth=geometry=>{writeWaterHeights(geometry,nearHeight.image.data);nearHeight.needsUpdate=true;};
 water.userData.dispose=()=>{water.getRenderTarget().dispose();nearHeight.dispose();farHeight.dispose();ripples.dispose();};return water;
}
