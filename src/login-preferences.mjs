const key='class-shop-student-login',autoShopKey='class-shop-auto-shop';
export function loginPreferences(){try{const p=JSON.parse(localStorage.getItem(key)||'{}');return {remember:p.remember===true,autoLogin:p.autoLogin===true,classCode:typeof p.classCode==='string'?p.classCode.slice(0,12):'',name:typeof p.name==='string'?p.name.slice(0,24):''};}catch{return {remember:false,autoLogin:false,classCode:'',name:''};}}
export function saveLoginPreferences({classCode,name,remember,autoLogin}){const data={remember:!!remember,autoLogin:!!autoLogin,classCode:remember?String(classCode).trim().toUpperCase():'',name:remember?String(name).trim():''};try{localStorage.setItem(key,JSON.stringify(data));}catch{}return data;}
export function rememberShop(id){try{sessionStorage.setItem('class-shop-last',id);if(loginPreferences().autoLogin)localStorage.setItem(autoShopKey,id);else localStorage.removeItem(autoShopKey);}catch{}}
export function lastStudentShop(){try{return sessionStorage.getItem('class-shop-last')||localStorage.getItem(autoShopKey)||'';}catch{return '';}}
export function clearActiveShop(){try{sessionStorage.removeItem('class-shop-last');localStorage.removeItem(autoShopKey);}catch{}}
