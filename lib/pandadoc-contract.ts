import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";

type ContractStudent = { fullName:string; documentId:string; address:string; country:string; email:string; phone:string; plan:number; installmentAmount:number; currency:string; network:string; wallet:string };
type ContractPayment = { installmentNo:number; amount:number; currency:string; dueDate:string };
type Provider = { name:string; documentId:string; address:string; email:string; phone:string };

const NAVY="17243C", BLUE="2E6694", GOLD="A47825", MUTED="6D788A", LINE="DCE2E9", LIGHT="F4F6F9";
const borders = {
  top:{style:BorderStyle.SINGLE,size:4,color:LINE}, bottom:{style:BorderStyle.SINGLE,size:4,color:LINE},
  left:{style:BorderStyle.SINGLE,size:4,color:LINE}, right:{style:BorderStyle.SINGLE,size:4,color:LINE},
  insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:LINE}, insideVertical:{style:BorderStyle.SINGLE,size:4,color:LINE},
};

function run(text:string, options:{bold?:boolean;color?:string;size?:number;italics?:boolean}={}) {
  return new TextRun({text,font:"Arial",size:options.size??19,bold:options.bold,italics:options.italics,color:options.color??NAVY});
}
function body(text:string) { return new Paragraph({children:[run(text)],spacing:{after:100,line:278}}); }
function heading(text:string) { return new Paragraph({heading:HeadingLevel.HEADING_1,children:[run(text,{bold:true,color:BLUE,size:26})],spacing:{before:260,after:120},keepNext:true}); }
function cell(children:Paragraph[],width:number,fill?:string) {
  return new TableCell({children,width:{size:width,type:WidthType.DXA},shading:fill?{type:ShadingType.CLEAR,fill}:undefined,margins:{top:100,bottom:100,left:130,right:130},verticalAlign:VerticalAlign.CENTER});
}
function labelValue(label:string,value:string) { return [
  new Paragraph({children:[run(label.toUpperCase(),{bold:true,color:MUTED,size:15})],spacing:{after:40}}),
  new Paragraph({children:[run(value,{bold:true,size:19})],spacing:{after:0}}),
]; }
function keyValueTable(rows:Array<[string,string]>) { return new Table({width:{size:9440,type:WidthType.DXA},columnWidths:[2300,7140],borders,rows:rows.map(([label,value])=>new TableRow({children:[
  cell([new Paragraph({children:[run(label,{bold:true,color:MUTED,size:16})]})],2300,LIGHT),
  cell([new Paragraph({children:[run(value,{size:17})]})],7140),
]}))}); }
function prettyDate(value:string) { return value?new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`)):"Sin fecha"; }
function personCell(title:string,rows:Array<[string,string]>) { return cell([
  new Paragraph({children:[run(title,{bold:true,color:BLUE,size:17})],spacing:{after:90}}),
  ...rows.map(([label,value])=>new Paragraph({children:[run(`${label}: `,{bold:true,color:MUTED,size:16}),run(value,{size:17})],spacing:{after:55}})),
],4720); }

export async function createPandaDocContract(student:ContractStudent,payments:ContractPayment[],provider:Provider) {
  const total=student.plan*student.installmentAmount;
  const unlocks:Record<number,string>={1:"Pilar Trading + comunidad + llamadas + clases + operativas + software TRADINVERSO",2:"Se añade Psicotrading y se mantienen todos los servicios",3:"Se añade Optimización Financiera y queda confirmado el acceso completo",4:"Se mantiene el acceso completo a todo el programa"};
  const paymentRows=[
    new TableRow({tableHeader:true,children:[
      cell([new Paragraph({children:[run("Pago",{bold:true,color:"FFFFFF",size:16})]})],700,NAVY),
      cell([new Paragraph({children:[run("Importe",{bold:true,color:"FFFFFF",size:16})]})],1800,NAVY),
      cell([new Paragraph({children:[run("Fecha acordada",{bold:true,color:"FFFFFF",size:16})]})],1900,NAVY),
      cell([new Paragraph({children:[run("Qué se desbloquea",{bold:true,color:"FFFFFF",size:16})]})],5040,NAVY),
    ]}),
    ...payments.map(payment=>new TableRow({children:[
      cell([new Paragraph({children:[run(String(payment.installmentNo),{size:16})]})],700),
      cell([new Paragraph({children:[run(`${payment.amount} ${payment.currency}`,{size:16})]})],1800),
      cell([new Paragraph({children:[run(prettyDate(payment.dueDate),{size:16})]})],1900),
      cell([new Paragraph({children:[run(unlocks[payment.installmentNo]||"Se mantiene el acceso completo",{size:16})]})],5040),
    ]})),
  ];
  const paymentDestination=student.currency==="EUR"?provider.phone:(student.wallet||"Pendiente de indicar");
  const doc=new Document({creator:"TRADINVERSO",title:`Acuerdo privado - ${student.fullName}`,description:"Acuerdo privado de acceso y pago del programa TRADINVERSO",styles:{default:{document:{run:{font:"Arial",size:19,color:NAVY},paragraph:{spacing:{after:100,line:278}}},heading1:{run:{font:"Arial",size:26,bold:true,color:BLUE},paragraph:{spacing:{before:260,after:120}}}}},sections:[{
    properties:{page:{size:{width:11906,height:16838},margin:{top:950,right:1300,bottom:950,left:1300,header:500,footer:500}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[run("TRADINVERSO · ACUERDO PRIVADO",{bold:true,color:MUTED,size:15})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run("Documento privado de acceso al programa TRADINVERSO",{color:MUTED,size:15})]})]})},
    children:[
      new Paragraph({children:[run("TRADINVERSO",{bold:true,color:GOLD,size:18})],spacing:{after:130}}),
      new Paragraph({children:[run("Acuerdo privado de acceso y pago",{bold:true,size:46})],spacing:{after:70}}),
      new Paragraph({children:[run("Programa completo · modalidad de pago en plazos",{color:MUTED,size:20})],spacing:{after:260}}),
      new Table({width:{size:9440,type:WidthType.DXA},columnWidths:[3146,3147,3147],borders,rows:[new TableRow({children:[cell(labelValue("Plan elegido",`${student.plan} pagos`),3146),cell(labelValue("Cada pago",`${student.installmentAmount} ${student.currency}`),3147),cell(labelValue("Total",`${total} ${student.currency}`),3147)]})]}),
      heading("Datos de las partes"),
      new Table({width:{size:9440,type:WidthType.DXA},columnWidths:[4720,4720],borders,rows:[new TableRow({children:[
        personCell("TRADINVERSO / RESPONSABLE",[["Nombre",provider.name],["DNI",provider.documentId],["Dirección",provider.address],["Correo",provider.email],["Teléfono",provider.phone]]),
        personCell("ALUMNO",[["Nombre",student.fullName],["DNI / Pasaporte",student.documentId],["Dirección",`${student.address}${student.country?`, ${student.country}`:""}`],["Correo",student.email],["Teléfono",student.phone]]),
      ]})]}),
      heading("Qué estamos acordando"),
      body("TRADINVERSO dará al alumno acceso al programa completo de formación y acompañamiento. El alumno elige pagar el precio total en varios plazos y se compromete a completar todos los pagos indicados en este documento."),
      body("Este plan no funciona como una suscripción mensual. Que el alumno deje de utilizar la formación, la comunidad o las sesiones no elimina el compromiso de completar las cantidades acordadas."),
      heading("Qué incluye TRADINVERSO"),
      body("La formación está dividida en tres pilares: Trading, Psicotrading y Optimización Financiera."),
      body("Desde el primer pago, el alumno tendrá acceso a la comunidad, llamadas, clases, operativas en directo, demás sesiones organizadas por TRADINVERSO y acceso al software TRADINVERSO. Los pilares formativos se abrirán progresivamente con cada pago."),
      heading("Cómo se abre el acceso"),
      keyValueTable([["Después del pago 1","Pilar Trading. Comunidad, llamadas, clases, operativas y software TRADINVERSO."],["Después del pago 2","Se añade Psicotrading. Se mantiene el acceso a todos los servicios."],["Después del pago 3","Se añade Optimización Financiera. Acceso completo a todo el programa confirmado."],...(student.plan===4?[["Después del pago 4","Los tres pilares permanecen disponibles y se mantiene el acceso completo."] as [string,string]]:[])]),
      heading("Calendario de pagos"),
      body(`El precio total acordado es de ${total} ${student.currency}, dividido en ${student.plan} pagos de ${student.installmentAmount} ${student.currency}.`),
      new Table({width:{size:9440,type:WidthType.DXA},columnWidths:[700,1800,1900,5040],borders,rows:paymentRows}),
      heading("Datos para el pago"),
      keyValueTable([["Moneda",student.currency],["Método / Red",student.currency==="EUR"?(student.network||"Bizum"):(student.network||"Pendiente de indicar")],["Destino del pago",paymentDestination]]),
      heading("Si un pago se retrasa"),
      body("Cada pago debe realizarse como máximo en la fecha acordada. Si al terminar ese día no se ha recibido, TRADINVERSO pausará desde el día siguiente todo el acceso del alumno: formación, comunidad, llamadas, clases, operativas en directo, software TRADINVERSO y cualquier otro servicio."),
      body("La pausa no cancela el compromiso de pago. En cuanto TRADINVERSO reciba el pago pendiente, el acceso se reactivará."),
      heading("Confirmación del acuerdo"),
      body("Con su firma, el alumno confirma que entiende el plan elegido, las fechas, el acceso progresivo y la pausa inmediata del servicio cuando exista un pago pendiente."),
      new Table({width:{size:9440,type:WidthType.DXA},columnWidths:[4720,4720],borders,rows:[new TableRow({children:[
        cell([new Paragraph({children:[run("TRADINVERSO / PRESTADOR",{bold:true,color:BLUE,size:16})],spacing:{after:100}}),new Paragraph({children:[run(`${provider.name} · DNI ${provider.documentId}`,{size:17})],spacing:{after:80}}),new Paragraph({children:[run("Confirmación del prestador",{color:MUTED,italics:true,size:15})]})],4720),
        cell([new Paragraph({children:[run("EL ALUMNO",{bold:true,color:BLUE,size:16})],spacing:{after:80}}),new Paragraph({children:[run(student.fullName,{size:17})],spacing:{after:80}}),new Paragraph({children:[run("Firma: ",{bold:true,color:MUTED,size:16}),run("[signature:Alumno:student_signature________________]",{size:16})],spacing:{after:90}}),new Paragraph({children:[run("Fecha: ",{bold:true,color:MUTED,size:16}),run("[date:Alumno:student_signing_date________]",{size:16})]})],4720),
      ]})]}),
    ],
  }]});
  return Packer.toBuffer(doc);
}
