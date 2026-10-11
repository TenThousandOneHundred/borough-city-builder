import * as THREE from './vendor/three.module.js';
import {Reflector} from './vendor/Reflector.js';
export function reflectedWater(view){
 const shader={name:'Borough river',uniforms:{color:{value:new THREE.Color('#314f54')},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0},night:{value:0},reflectionEnabled:{value:1}},vertexShader:`
 uniform mat4 textureMatrix;varying vec4 projected;varying vec3 world;varying vec3 eye;
 void main(){projected=textureMatrix*vec4(position,1.);world=(modelMatrix*vec4(position,1.)).xyz;eye=cameraPosition-world;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
 `,fragmentShader:`
 uniform sampler2D tDiffuse;uniform vec3 color;uniform float time,night,reflectionEnabled;varying vec4 projected;varying vec3 world;varying vec3 eye;
 void main(){vec2 p=world.xz;vec2 ripple=vec2(sin(p.x*1.6+p.y*.8+time*.6)+sin(p.y*3.2-time*.9)*.45,cos(p.y*1.8-p.x*.7+time*.4));vec3 n=normalize(vec3(ripple.x*.035,1.,ripple.y*.035));vec3 v=normalize(eye);float fres=.09+.66*pow(1.-max(dot(n,v),0.),3.);vec2 uv=projected.xy/projected.w+ripple*.0014;vec3 reflection=texture2D(tDiffuse,uv).rgb;vec3 deep=color*(.72+.1*sin(p.x*.14+p.y*.19));deep*=mix(1.,.22,night);vec3 c=mix(deep,reflection,fres*reflectionEnabled);float spec=pow(max(dot(reflect(-normalize(vec3(-.65,.95,.7)),n),v),0.),160.);c+=vec3(1.,.93,.78)*spec*.24*(1.-night);gl_FragColor=vec4(c,1.);}
 `};
 const water=new Reflector(new THREE.PlaneGeometry(1100,1100),{color:0x547f89,textureWidth:384,textureHeight:384,multisample:0,clipBias:.002,shader});
 water.rotation.x=-Math.PI/2;water.position.y=-.1;
 const render=water.onBeforeRender;let last=-1;
 water.onBeforeRender=(renderer,scene,camera)=>{const t=performance.now();if(view.reflectionsEnabled===false||view.detailEnabled===false||t-last<250)return;last=t;render(renderer,scene,camera);};
 water.userData.dispose=()=>water.getRenderTarget().dispose();return water;
}
