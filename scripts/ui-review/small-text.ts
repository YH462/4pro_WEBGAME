import type { Page } from '@playwright/test';
export type SmallTextItem = {number:number;text:string;size:number;color:string;kind:string;tag:string;className:string;boxes:{x:number;y:number;width:number;height:number}[]};

/** Read actual rendered text, including form values and placeholders. */
export async function collectSmallText(page: Page) {
  return page.evaluate<SmallTextItem[]>(String.raw`(() => {
    const items = [];
    const visible = (element) => {
      if (!(element instanceof HTMLElement) || !element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) return false;
      const modal=document.querySelector('dialog[open]');
      if(modal && !modal.contains(element)) return false;
      if (element.closest('script,style,noscript,option,.sr-only,[class*="srOnly"],[data-nextjs-dialog]')) return false;
      for (let current=element; current; current=current.parentElement) {
        const style=getComputedStyle(current);
        if (style.clipPath==='inset(50%)' || style.clip==='rect(0px, 0px, 0px, 0px)') return false;
      }
      return true;
    };
    const boxes = (rects) => Array.from(rects).filter(rect=>rect.width>1&&rect.height>1&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight).map(rect=>({x:Math.max(0,rect.x),y:Math.max(0,rect.y),width:Math.min(innerWidth,rect.right)-Math.max(0,rect.x),height:Math.min(innerHeight,rect.bottom)-Math.max(0,rect.y)}));
    const add = (element,text,kind,rects,pseudo) => {
      if (!text.trim() || !visible(element)) return;
      const style=getComputedStyle(element,pseudo),size=parseFloat(style.fontSize);
      if(size<=0||size>13)return;
      const positions=boxes(rects);if(!positions.length)return;
      items.push({text:text.trim().replace(/\s+/g,' '),size,color:style.color,kind,tag:element.tagName.toLowerCase(),className:element.className,boxes:positions});
    };
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()) {
      const element=node.parentElement;
      if(!element || !(element instanceof HTMLElement) || !node.textContent?.trim() || !visible(element))continue;
      const range=document.createRange();range.selectNodeContents(node);
      add(element,node.textContent,'本文',range.getClientRects());
    }
    for(const element of document.querySelectorAll('input,textarea,select')) {
      if(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement))continue;
      if(element instanceof HTMLInputElement&&['password','file','hidden','checkbox','radio'].includes(element.type))continue;
      const text=element instanceof HTMLSelectElement?element.selectedOptions[0]?.textContent:element.value||element.placeholder;
      add(element,text||'',element.value?'入力値':'入力例',[element.getBoundingClientRect()],!element.value&&!(element instanceof HTMLSelectElement)?'::placeholder':undefined);
    }
    return items.map((item,index)=>({number:index+1,...item}));
  })()`);
}
