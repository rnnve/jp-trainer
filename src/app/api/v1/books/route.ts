import {books} from '@/lib/content';
export function GET(){return Response.json({data:books});}
