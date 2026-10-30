/** Pointer bookkeeping is independent from WebGL, so touch edge cases are testable. */
export function createPointerGesture(threshold = 9) {
  let active = null;
  return {
    start({pointerId,clientX,clientY,button=0}) {
      if(button!==0)return false;
      if(active){active.cancelled=true;return false;}
      active={pointerId,x:clientX,y:clientY,moved:false,cancelled:false};return true;
    },
    move({pointerId,clientX,clientY}) {
      if(!active||pointerId!==active.pointerId)return null;
      const dx=clientX-active.x,dy=clientY-active.y;
      if(Math.hypot(dx,dy)>threshold)active.moved=true;
      return {dx,dy,horizontal:Math.abs(dx)>Math.abs(dy),moved:active.moved};
    },
    end(event) {
      if(!active||event.pointerId!==active.pointerId)return false;
      this.move(event);const tap=!active.moved&&!active.cancelled;active=null;return tap;
    },
    cancel(){active=null;},
  };
}
export function renderProfile({width,coarse=false,dpr=1,reducedMotion=false}) {
  const mobile=width<=720||coarse;
  return {mobile,pixelRatio:Math.min(dpr,mobile?1.25:1.7),fps:reducedMotion?15:mobile?30:60,shadows:!mobile};
}

// Finishing the timeline is not an explicit pause: allow a short celebration.
export function sceneShouldPause({playing,completed,fault='none'}) {
  return fault!=='none'||(!playing&&!completed);
}
