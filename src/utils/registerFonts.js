// ─────────────────────────────────────────────────────────────────────────────
// Registra a fonte Roboto (TTF real) embutida no PDF, para renderizar
// IDÊNTICA em qualquer sistema operacional (Windows, Mac, Linux) e em
// qualquer visualizador (Adobe Reader, Edge, Chrome, Preview, etc).
//
// Isso resolve o bug de colunas/linhas sobrepostas: quando o jsPDF usa
// fontes padrão (Helvetica), o Windows substitui por Arial, cujas métricas
// de largura são levemente diferentes das que o jsPDF usou para calcular
// splitTextToSize() / altura de linha. Com a fonte embutida, o cálculo e
// o desenho final usam exatamente a mesma métrica, em qualquer máquina.
// ─────────────────────────────────────────────────────────────────────────────
import { RobotoRegular } from './fonts/Roboto-Regular-base64'
import { RobotoBold } from './fonts/Roboto-Bold-base64'

export function registerFonts(doc) {
  doc.addFileToVFS('Roboto-Regular.ttf', RobotoRegular)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')

  doc.addFileToVFS('Roboto-Bold.ttf', RobotoBold)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

  doc.setFont('Roboto', 'normal') // define como fonte padrão do documento
}
