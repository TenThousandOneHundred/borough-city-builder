import {waterHeightTexture,writeWaterHeights} from './water-depth.js?v=58';
import * as THREE from './vendor/three.module.js';
import {Reflector} from './vendor/Reflector.js';
export function reflectedWater(view,ground,far){
 const nearHeight=waterHeightTexture(ground),farHeight=waterHeightTexture(far);
 const shader={name:'Borough river',uniforms:{color:{value:new THREE.Color('#30627e')},shallowColor:{value:new THREE.Color('#659b8e')},nearHeight:{value:nearHeight},farHeight:{value:farHeight},heightSizes:{value:new THREE.Vector2(nearHeight.image.width,farHeight.image.width)},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0},night:{value:0},reflectionEnabled:{value:1}},vertexShader:`
 uniform mat4 textureMatrix;varying vec4 projected;varying vec3 world;varying vec3 eye;
 void main(){projected=textureMatrix*vec4(position,1.);world=(modelMatrix*vec4(position,1.)).xyz;eye=cameraPosition-world;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
 `,fragmentShader:`
 uniform sampler2D tDiffuse,nearHeight,farHeight;uniform vec3 color,shallowColor;uniform vec2 heightSizes;uniform float time,night,reflectionEnabled;varying vec4 projected;varying vec3 world;varying vec3 eye;
 float bedHeight(vec2 p){
  bool near=abs(p.x)<=96.&&abs(p.y)<=96.;float size=near?heightSizes.x:heightSizes.y,extent=near?96.:550.;
  vec2 uv=clamp((p/(extent*2.)+.5)*(size-1.)/size+.5/size,vec2(.5/size),vec2(1.-.5/size));
  vec2 encodedHeight=near?texture2D(nearHeight,uv).rg:texture2D(farHeight,uv).rg;
  return dot(encodedHeight,vec2(255.,255./256.))-64.;
 }
 void main(){vec2 p=world.xz;float depth=max(0.,-.1-bedHeight(p));vec2 ripple=vec2(sin(p.x*1.6+p.y*.8+time*.6)+sin(p.y*3.2-time*.9)*.45,cos(p.y*1.8-p.x*.7+time*.4));vec3 n=normalize(vec3(ripple.x*.09,1.,ripple.y*.09));vec3 v=normalize(eye);float fres=.09+.66*pow(1.-max(dot(n,v),0.),3.);vec2 uv=projected.xy/projected.w+ripple*.0014;vec3 reflection=texture2D(tDiffuse,uv).rgb;float windPhase=p.x*.75+p.y*3.9-time*.8,smallPhase=p.x*2.3-p.y*7.1+time*1.1;float wind=.09*sin(windPhase)/(1.+fwidth(windPhase)*2.)+.045*sin(smallPhase)/(1.+fwidth(smallPhase)*2.);vec3 deep=mix(shallowColor,color,1.-exp(-depth*1.2))*(.94+wind);deep*=mix(1.,.22,night);vec3 c=mix(deep,reflection,fres*reflectionEnabled);float spec=pow(max(dot(reflect(-normalize(vec3(-.65,.95,.7)),n),v),0.),96.);c+=vec3(1.,.93,.78)*spec*.24*(1.-night);
 float shoreNoise=.5+.25*sin(p.x*4.7+p.y*2.9)+.25*sin(p.x*7.3-p.y*5.1+time*.5);
 float wash=.10+.035*sin(time*1.3+p.x*.4+p.y*.3),foam=(1.-smoothstep(wash,wash+.12,depth))*smoothstep(.005,.04,depth)*shoreNoise;
 c=mix(c,vec3(.68,.76,.70)*mix(1.,.2,night),foam*.28);
 gl_FragColor=vec4(c,1.);}
 `};
 const water=new Reflector(new THREE.PlaneGeometry(1100,1100),{color:0x30627e,textureWidth:384,textureHeight:384,multisample:0,clipBias:.002,shader});
 water.material.uniforms.nearHeight.value=nearHeight;water.material.uniforms.farHeight.value=farHeight;
 water.rotation.x=-Math.PI/2;water.position.y=-.1;
 const render=water.onBeforeRender;let last=-1;
 water.onBeforeRender=(renderer,scene,camera)=>{const t=performance.now();if(view.reflectionsEnabled===false||view.detailEnabled===false||t-last<250)return;last=t;render(renderer,scene,camera);};
 water.userData.refreshDepth=geometry=>{writeWaterHeights(geometry,nearHeight.image.data);nearHeight.needsUpdate=true;};
 water.userData.dispose=()=>{water.getRenderTarget().dispose();nearHeight.dispose();farHeight.dispose();};return water;
}
