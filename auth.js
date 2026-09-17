(() => {
  const cfg=window.HOPPANG_CONFIG||{};
  const configured=Boolean(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&window.supabase);
  const client=configured?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
  const listeners=[];
  let user=null, purchases=[];
  async function refresh(){
    if(!client){user=null;purchases=[];emit();return}
    const {data}=await client.auth.getSession(); user=data.session?.user||null;
    await loadPurchases(); emit();
  }
  async function loadPurchases(){
    if(!client||!user){purchases=[];return []}
    const {data,error}=await client.from('purchases').select('work_id,purchased_at').eq('user_id',user.id);
    purchases=error?[]:(data||[]); return purchases;
  }
  function emit(){listeners.forEach(fn=>fn({user,purchases:[...purchases],configured}))}
  async function signIn(email,password){if(!client)throw new Error('AUTH_NOT_CONFIGURED');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;await loadPurchases();emit();return data}
  async function signUp(email,password){if(!client)throw new Error('AUTH_NOT_CONFIGURED');const {data,error}=await client.auth.signUp({email,password});if(error)throw error;user=data.user;await loadPurchases();emit();return data}
  async function signOut(){if(client)await client.auth.signOut();user=null;purchases=[];emit()}
  async function token(){if(!client)return null;const {data}=await client.auth.getSession();return data.session?.access_token||null}
  function owns(workId){return purchases.some(p=>p.work_id===workId)}
  function onChange(fn){listeners.push(fn);fn({user,purchases:[...purchases],configured});return()=>listeners.splice(listeners.indexOf(fn),1)}
  if(client)client.auth.onAuthStateChange(()=>setTimeout(refresh,0));
  window.HoppangAuth={configured,client,refresh,signIn,signUp,signOut,token,owns,onChange,get user(){return user},get purchases(){return [...purchases]}};
  refresh();
})();