/** A mounted project never grants general conversations implicit file access. */
export function hasProjectScope(tab:string,session:{isWorkspaceBound?:boolean;workspaceId?:string}|undefined,workspaceId:string|undefined):boolean{
 return tab==='code_studio' && session?.isWorkspaceBound===true && !!workspaceId && session.workspaceId===workspaceId;
}
