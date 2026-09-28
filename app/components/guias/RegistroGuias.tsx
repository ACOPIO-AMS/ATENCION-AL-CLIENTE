"use client";
import { RefObject } from "react";
import { GUIAS_HTML_INTEGRADO } from "../../lib/guias-html";
export default function RegistroGuias({frameRef,onLoad}:{frameRef:RefObject<HTMLIFrameElement|null>;onLoad:()=>void}) {
 return <section style={{padding:0,margin:0,width:"100%",minHeight:"calc(100vh - 92px)",background:"#f4f6f8"}}><iframe ref={frameRef} title="Registro de Guías" srcDoc={GUIAS_HTML_INTEGRADO} onLoad={onLoad} style={{width:"100%",height:"calc(100vh - 92px)",minHeight:760,border:0,display:"block",background:"white"}} allow="clipboard-read; clipboard-write"/></section>;
}
