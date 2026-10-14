# Auth Testing (Emergent Google Auth) — MatShop.id

- Fastest: POST /api/auth/demo {"role":"contractor_buyer"|"supplier_vendor"|"designer_creator"} -> returns token; also sets `session_token` cookie.
- Or create a user + session manually:
```
mongosh --eval "
use('test_database');
var userId='test-user-'+Date.now(); var t='test_session_'+Date.now();
db.users.insertOne({user_id:userId,email:'test.user.'+Date.now()+'@example.com',name:'Test User',picture:'',primary_role:null,enabled_roles:[],active_role:null,created_at:new Date()});
db.user_sessions.insertOne({user_id:userId,session_token:t,expires_at:new Date(Date.now()+7*864e5),created_at:new Date()});
print(t);"
```
- New user with primary_role null => onboarding modal appears.
- Browser: add cookie `session_token` (httpOnly, secure, sameSite None, path /) for the preview domain.
- API: `Authorization: Bearer <token>` against /api/auth/me.
