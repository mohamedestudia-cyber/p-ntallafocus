import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();
const app=express();
const PORT=Number(process.env.PORT||3000);
const MODEL=process.env.OPENAI_MODEL||'gpt-4.1-mini';
const allowed=(process.env.ALLOWED_ORIGINS||'http://localhost:3000,http://127.0.0.1:3000').split(',').map(x=>x.trim()).filter(Boolean);
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin(origin,cb){if(!origin||allowed.includes(origin))return cb(null,true);cb(new Error('Origen no permitido'))},methods:['GET','POST'],allowedHeaders:['Content-Type']}));
app.use(express.json({limit:'32kb'}));
const limiter=rateLimit({windowMs:60_000,limit:12,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Has alcanzado el límite temporal. Espera un minuto e inténtalo de nuevo.'}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter(_req,file,cb){if(['image/jpeg','image/png','image/webp'].includes(file.mimetype))cb(null,true);else cb(new Error('Formato de imagen no compatible.'))}});
const client=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;
app.get('/api/health',(_req,res)=>res.json({ok:true,configured:Boolean(client),model:client?MODEL:null}));
app.post('/api/focusia',limiter,upload.single('image'),async(req,res)=>{
  try{
    if(!client)return res.status(503).json({error:'FocusIA todavía no está configurado en el servidor.'});
    const message=typeof req.body.message==='string'?req.body.message.trim():'';
    const language=['es','ca','en'].includes(req.body.language)?req.body.language:'es';
    if(!message&&!req.file)return res.status(400).json({error:'Escribe una pregunta o adjunta una imagen.'});
    if(message.length>6000)return res.status(413).json({error:'El mensaje es demasiado largo.'});
    const lang={es:'español',ca:'catalán',en:'inglés'}[language];
    const instructions=`Eres FocusIA, un tutor educativo claro, paciente y riguroso. Responde en ${lang}. Adapta el nivel al contexto disponible. No inventes información que falte; si una imagen no es legible, dilo. Para matemáticas y ciencias, organiza la explicación en datos, qué se pide, fórmula y motivo, variables, operaciones paso a paso, resultado y comprobación. No afirmes que eres una persona ni un profesional sanitario. Ayuda a aprender, no solo a copiar respuestas.`;
    const content=[];
    if(message)content.push({type:'input_text',text:message});
    if(req.file){const mime=req.file.mimetype;const data=req.file.buffer.toString('base64');content.push({type:'input_image',image_url:`data:${mime};base64,${data}`,detail:'high'});}
    let history=[];
    try { const parsed=JSON.parse(req.body.context||'{}'); if(Array.isArray(parsed.conversation)) history=parsed.conversation.slice(-10).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:[{type:'input_text',text:m.content.slice(0,3000)}]})); } catch {}
    const response=await client.responses.create({model:MODEL,instructions,input:[...history,{role:'user',content}],max_output_tokens:1800});
    const answer=response.output_text?.trim();
    if(!answer)throw new Error('El modelo no ha devuelto texto.');
    res.json({answer,model:MODEL});
  }catch(err){
    console.error('FocusIA request failed:',err?.status||err?.name||'error');
    const status=err?.status===429?429:err?.status===400?400:500;
    res.status(status).json({error:status===429?'El servicio de IA está ocupado o ha alcanzado su límite.':status===400?'No se ha podido procesar la petición. Revisa la imagen y el mensaje.':'No se ha podido completar la consulta. Inténtalo de nuevo más tarde.'});
  }
});
app.use((err,_req,res,_next)=>{if(err instanceof multer.MulterError)return res.status(413).json({error:'La imagen supera el límite permitido.'});if(err) return res.status(400).json({error:err.message==='Origen no permitido'?'Origen no permitido':'Petición no válida.'});});
app.listen(PORT,()=>console.log(`FocusIA backend listening on port ${PORT}`));