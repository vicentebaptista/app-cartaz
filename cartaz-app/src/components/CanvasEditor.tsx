import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Download, Type, Square, Save, FolderOpen, Trash2, RotateCw, Image as ImageIcon, Upload, Printer, X, FileText, RefreshCw, Bold, Italic, Strikethrough, Underline, Layers, ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight, FileInput, FileOutput } from 'lucide-react';

const PIXELS_PER_CM = 37.8; 

interface PaperSize {
  width: number;
  height: number;
  label: string;
  isCustom?: boolean;
}

const PRESET_SIZES: PaperSize[] = [
  { width: 59, height: 43, label: 'Padrão 59x43 cm' },
  { width: 60, height: 41, label: 'Padrão 60x41 cm' },
  { width: 29.7, height: 42, label: 'A3 (29.7x42 cm)' },
  { width: 21, height: 29.7, label: 'A4 (21x29.7 cm)' },
  { width: 0, height: 0, label: '>> Personalizado', isCustom: true },
];

// Lista expandida de fontes
const FONTS = [
  'Arial', 'Verdana', 'Times New Roman',
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 
  'Anton', 'Bebas Neue', 'Russo One', 'Sigmar One', 'Titan One', 'Carter One', 'Bangers',
  'Lobster', 'Pacifico', 'Yellowtail', 'Permanent Marker', 'Fredoka'
];

const DATA_TYPES = [
    { label: 'Sem vínculo', value: '' },
    { label: 'Nome do Produto', value: 'product_name' },
    { label: 'Preço Principal', value: 'price_main' },
    { label: 'Preço Secundário', value: 'price_sub' },
    { label: 'Detalhe/Peso', value: 'detail' },
];

// Helper para gerar ID único simples
const generateId = () => Math.random().toString(36).substr(2, 9);

export const CanvasEditor = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  
  const [selectedSize, setSelectedSize] = useState<PaperSize>(PRESET_SIZES[0]);
  const [customWidth, setCustomWidth] = useState(50);
  const [customHeight, setCustomHeight] = useState(50);
  const [isLandscape, setIsLandscape] = useState(true);

  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [editMode, setEditMode] = useState<'design' | 'fill'>('design');
  
  // Estados Design
  const [color, setColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(40);
  const [textAlign, setTextAlign] = useState<string>('center');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isLinethrough, setIsLinethrough] = useState(false);
  const [dataTag, setDataTag] = useState('');

  const [formFields, setFormFields] = useState<{id: string, label: string, value: string}[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedFiles, setSavedFiles] = useState<string[]>([]);

  // --- Inicialização ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: getEffectiveWidth() * PIXELS_PER_CM,
      height: getEffectiveHeight() * PIXELS_PER_CM,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

    canvas.on('selection:created', (e) => handleSelection(e.selected[0]));
    canvas.on('selection:updated', (e) => handleSelection(e.selected[0]));
    canvas.on('selection:cleared', () => setSelectedObject(null));

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Helpers de Dimensão
  const getEffectiveWidth = () => {
    const w = selectedSize.isCustom ? customWidth : selectedSize.width;
    const h = selectedSize.isCustom ? customHeight : selectedSize.height;
    return isLandscape ? w : h;
  };

  const getEffectiveHeight = () => {
    const w = selectedSize.isCustom ? customWidth : selectedSize.width;
    const h = selectedSize.isCustom ? customHeight : selectedSize.height;
    return isLandscape ? h : w;
  };

  // Atualiza tamanho quando muda configurações
  useEffect(() => {
    if (fabricCanvas) {
      fabricCanvas.setDimensions({
        width: getEffectiveWidth() * PIXELS_PER_CM,
        height: getEffectiveHeight() * PIXELS_PER_CM,
      });
      fabricCanvas.renderAll();
    }
  }, [selectedSize, customWidth, customHeight, isLandscape, fabricCanvas]);

  // Escaneia campos no modo Fill
  useEffect(() => {
    if (editMode === 'fill' && fabricCanvas) {
        scanFields();
    }
  }, [editMode, fabricCanvas]);

  // Atalhos de Teclado (Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Evita deletar se estiver digitando em um input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        if (fabricCanvas) {
            const activeObj = fabricCanvas.getActiveObject();
            if (activeObj) {
                // Se for um texto em edição, não deleta o objeto
                // @ts-ignore
                if (activeObj.isEditing) return;

                fabricCanvas.remove(activeObj);
                fabricCanvas.discardActiveObject();
                fabricCanvas.renderAll();
                setSelectedObject(null);
            }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabricCanvas]);

  const scanFields = () => {
    if (!fabricCanvas) return;
    const fields: {id: string, label: string, value: string}[] = [];
    const objects = fabricCanvas.getObjects();
    
    objects.forEach((obj: any) => {
        if (obj.dataTag && obj instanceof fabric.Textbox) {
            const typeLabel = DATA_TYPES.find(t => t.value === obj.dataTag)?.label || obj.dataTag;
            fields.push({
                id: obj.dataTag,
                label: typeLabel,
                value: obj.text
            });
        }
    });
    
    const uniqueFields = fields.filter((field, index, self) => 
        index === self.findIndex((t) => t.id === field.id)
    );

    setFormFields(uniqueFields);
    fabricCanvas.discardActiveObject();
    fabricCanvas.renderAll();
  };

  const handleSelection = (obj: any) => {
    setSelectedObject(obj);
    if (obj) {
        const fill = obj.fill;
        if (typeof fill === 'string') setColor(fill);
        
        if (obj instanceof fabric.Textbox) {
            setFontFamily(obj.fontFamily || 'Arial');
            setFontSize(obj.fontSize || 40);
            setTextAlign(obj.textAlign || 'left');
            setIsBold(obj.fontWeight === 'bold');
            setIsItalic(obj.fontStyle === 'italic');
            setIsUnderline(!!obj.underline);
            
            // Verifica se existe linha de risco vinculada pelo ID
            // @ts-ignore
            const myId = obj.id;
            const hasLine = fabricCanvas?.getObjects().some(o => (o as any).strikeFor === myId);
            setIsLinethrough(!!hasLine);

            setDataTag(obj.dataTag || '');
        } else {
            setDataTag('');
        }
    }
  };

  // --- Funções de Edição ---

  const changeColor = (newColor: string) => {
    setColor(newColor);
    if (fabricCanvas && selectedObject) {
      selectedObject.set('fill', newColor);
      fabricCanvas.renderAll();
    }
  };

  const changeFont = (newFont: string) => {
    setFontFamily(newFont);
    if (fabricCanvas && selectedObject && selectedObject instanceof fabric.Textbox) {
      selectedObject.set('fontFamily', newFont);
      fabricCanvas.renderAll();
    }
  };

  const changeFontSize = (newSize: number) => {
    setFontSize(newSize);
    if (fabricCanvas && selectedObject && selectedObject instanceof fabric.Textbox) {
        selectedObject.set('fontSize', newSize);
        fabricCanvas.renderAll();
    }
  };

  const changeTextAlign = (align: string) => {
    setTextAlign(align);
    if (fabricCanvas && selectedObject && selectedObject instanceof fabric.Textbox) {
        selectedObject.set('textAlign', align);
        fabricCanvas.renderAll();
    }
  };

  const toggleBold = () => {
      const newValue = !isBold;
      setIsBold(newValue);
      if (fabricCanvas && selectedObject && selectedObject instanceof fabric.Textbox) {
          selectedObject.set('fontWeight', newValue ? 'bold' : 'normal');
          fabricCanvas.renderAll();
      }
  };

  const toggleItalic = () => {
      const newValue = !isItalic;
      setIsItalic(newValue);
      if (fabricCanvas && selectedObject && selectedObject instanceof fabric.Textbox) {
          selectedObject.set('fontStyle', newValue ? 'italic' : 'normal');
          fabricCanvas.renderAll();
      }
  };

  const toggleUnderline = () => {
      const newValue = !isUnderline;
      setIsUnderline(newValue);
      if (fabricCanvas && selectedObject && selectedObject instanceof fabric.Textbox) {
          selectedObject.set('underline', newValue);
          fabricCanvas.renderAll();
      }
  };

  const toggleLinethrough = () => {
      if (!fabricCanvas || !selectedObject || !(selectedObject instanceof fabric.Textbox)) return;
      
      // @ts-ignore
      const myId = selectedObject.id;
      if (!myId) return; // Segurança
      
      const newValue = !isLinethrough;
      setIsLinethrough(newValue);

      if (newValue) {
          const width = selectedObject.width! * selectedObject.scaleX!;
          const height = selectedObject.height! * selectedObject.scaleY!;
          
          const line = new fabric.Rect({
              left: selectedObject.left,
              top: selectedObject.top! + (height / 2),
              width: width,
              height: height * 0.1,
              fill: selectedObject.fill,
              originX: selectedObject.originX,
              originY: 'center',
              // @ts-ignore
              strikeFor: myId // Vincula pelo ID (String), muito mais seguro
          });
          
          fabricCanvas.add(line);
          fabricCanvas.setActiveObject(line);
      } else {
          const objects = fabricCanvas.getObjects();
          const line = objects.find(o => (o as any).strikeFor === myId);
          if (line) {
              fabricCanvas.remove(line);
          }
      }
      fabricCanvas.renderAll();
  };

  const moveLayer = (direction: 'up' | 'down') => {
      if (!fabricCanvas || !selectedObject) return;
      if (direction === 'up') {
          selectedObject.bringToFront();
      } else {
          selectedObject.sendToBack();
      }
      fabricCanvas.renderAll();
  };
  
  const changeDataTag = (tag: string) => {
    setDataTag(tag);
    if (fabricCanvas && selectedObject) {
        // @ts-ignore
        selectedObject.set('dataTag', tag);
        fabricCanvas.renderAll();
    }
  };

  const deleteSelected = () => {
    if (fabricCanvas && selectedObject) {
        fabricCanvas.remove(selectedObject);
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        setSelectedObject(null);
    }
  };

  const updateFieldValue = (tag: string, newValue: string) => {
    setFormFields(prev => prev.map(f => f.id === tag ? {...f, value: newValue} : f));
    if (fabricCanvas) {
        const objects = fabricCanvas.getObjects();
        objects.forEach((obj: any) => {
            if (obj.dataTag === tag && obj instanceof fabric.Textbox) {
                obj.set('text', newValue);
            }
        });
        fabricCanvas.renderAll();
    }
  };

  // --- Adição de Elementos ---

  const addText = (text: string, fontSize: number = 40, color: string = '#000000') => {
    if (!fabricCanvas) return;
    const textbox = new fabric.Textbox(text, {
      left: 50, top: 50, fontSize: fontSize,
      fontFamily: 'Anton', fill: color, width: 300, textAlign: 'center',
      // @ts-ignore
      id: generateId() // Garante que todo texto tenha ID
    });
    fabricCanvas.add(textbox);
    fabricCanvas.setActiveObject(textbox);
  };

  const addRect = () => {
    if (!fabricCanvas) return;
    const rect = new fabric.Rect({
      left: 100, top: 100, fill: '#ffff00',
      width: 200, height: 100, stroke: 'black', strokeWidth: 1,
      // @ts-ignore
      id: generateId()
    });
    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
  };

  const addCircle = () => {
    if (!fabricCanvas) return;
    const circle = new fabric.Circle({
        left: 150, top: 150, radius: 50, fill: 'red',
        // @ts-ignore
        id: generateId()
    });
    fabricCanvas.add(circle);
    fabricCanvas.setActiveObject(circle);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!fabricCanvas || !e.target.files || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        if (event.target?.result) {
            const imgObj = new Image();
            imgObj.src = event.target.result as string;
            imgObj.onload = () => {
                const imgInstance = new fabric.Image(imgObj);
                if (imgInstance.width && imgInstance.width > 300) imgInstance.scaleToWidth(300);
                imgInstance.set({ left: 100, top: 100 });
                // @ts-ignore
                imgInstance.set('id', generateId());
                fabricCanvas.add(imgInstance);
                fabricCanvas.setActiveObject(imgInstance);
            };
        }
    };
    reader.readAsDataURL(e.target.files[0]);
    e.target.value = '';
  };

  const handleSVGUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!fabricCanvas || !e.target.files || !e.target.files[0]) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              const svgString = event.target.result as string;
              fabric.loadSVGFromString(svgString).then((result) => {
                  const { objects, options } = result;
                  const loadedObject = fabric.util.groupSVGElements(objects, options);
                  loadedObject.scaleToWidth(fabricCanvas.width! * 0.8);
                  loadedObject.set({ left: fabricCanvas.width! * 0.1, top: fabricCanvas.height! * 0.1 });
                  // @ts-ignore
                  loadedObject.set('id', generateId());
                  fabricCanvas.add(loadedObject);
                  fabricCanvas.setActiveObject(loadedObject);
                  fabricCanvas.renderAll();
              });
          }
      };
      reader.readAsText(e.target.files[0]);
      e.target.value = '';
  };

  // --- Sistema de Arquivos ---

  const saveLayout = () => {
    if (!fabricCanvas) return;
    
    const fieldMapping: {index: number, tag: string}[] = [];
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj: any, index) => {
        if (obj.dataTag) {
            fieldMapping.push({ index, tag: obj.dataTag });
        }
        // Garante que todos tenham ID antes de salvar
        if (!obj.id) obj.id = generateId();
    });

    // Salva ID, dataTag e strikeFor (que agora é string)
    // @ts-ignore
    const json = fabricCanvas.toJSON(['id', 'dataTag', 'strikeFor']);
    
    const layoutName = prompt('Nome do layout:', 'Novo Layout');
    if (layoutName) {
        const saveData = {
            json,
            fieldMapping,
            width: selectedSize.isCustom ? customWidth : selectedSize.width,
            height: selectedSize.isCustom ? customHeight : selectedSize.height,
            isCustom: selectedSize.isCustom,
            isLandscape: isLandscape
        };
        localStorage.setItem(`layout_${layoutName}`, JSON.stringify(saveData));
        alert('Layout salvo com sucesso!');
    }
  };

  const openLoadModal = () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('layout_'));
      setSavedFiles(keys);
      setShowLoadModal(true);
  };

  const loadLayoutFile = (key: string) => {
      if (!fabricCanvas) return;
      try {
        const savedString = localStorage.getItem(key);
        if (!savedString) return;

        const savedData = JSON.parse(savedString);
        const isModernFormat = savedData.json && savedData.width;
        const jsonToLoad = isModernFormat ? savedData.json : savedData;

        if (isModernFormat) {
            setIsLandscape(savedData.isLandscape);
            if (savedData.isCustom) {
                const customOpt = PRESET_SIZES.find(p => p.isCustom)!;
                setSelectedSize(customOpt);
                setCustomWidth(savedData.width);
                setCustomHeight(savedData.height);
            } else {
                const preset = PRESET_SIZES.find(p => p.width === savedData.width && p.height === savedData.height);
                if (preset) setSelectedSize(preset);
            }
        }

        fabricCanvas.loadFromJSON(jsonToLoad).then(() => {
            if (isModernFormat) {
                 const w = savedData.isCustom ? savedData.width : (PRESET_SIZES.find(p => p.width === savedData.width)?.width || 59);
                 const h = savedData.isCustom ? savedData.height : (PRESET_SIZES.find(p => p.width === savedData.width)?.height || 43);
                 const effW = savedData.isLandscape ? w : h;
                 const effH = savedData.isLandscape ? h : w;

                 fabricCanvas.setDimensions({
                    width: effW * PIXELS_PER_CM,
                    height: effH * PIXELS_PER_CM
                 });
            }

            const objects = fabricCanvas.getObjects();
            objects.forEach((obj: any, index) => {
                if (savedData.fieldMapping) {
                     const mapping = savedData.fieldMapping.find((m: any) => m.index === index);
                     if (mapping) {
                         obj.set('dataTag', mapping.tag);
                     }
                }
                // Garante ID se perdeu
                if (!obj.id) obj.set('id', generateId());

                // Corrige texto quebrado e REAPLICA FONTES E ESTILOS
                if (obj instanceof fabric.Textbox) {
                     obj.set('dirty', true); 
                     
                     // Truque para acordar o renderizador de fontes
                     const originalFont = obj.fontFamily;
                     const originalWeight = obj.fontWeight;
                     const originalStyle = obj.fontStyle;

                     obj.set('fontFamily', 'Times New Roman'); 
                     obj.set('fontFamily', originalFont);
                     
                     // Reafirma propriedades de estilo
                     if (originalWeight) obj.set('fontWeight', originalWeight);
                     if (originalStyle) obj.set('fontStyle', originalStyle);

                     obj.set('splitByGrapheme', true);
                     obj.initDimensions();
                }
            });

            // Força renderização final
            fabricCanvas.requestRenderAll();

            if (editMode === 'fill') {
               setTimeout(scanFields, 200);
            }
            
            setShowLoadModal(false);
            alert("Layout carregado com sucesso!");
        });

      } catch (e) {
          alert('Erro ao carregar arquivo');
          console.error(e);
      }
  };

  const deleteLayoutFile = (key: string) => {
      if (confirm('Tem certeza que deseja excluir este layout?')) {
          localStorage.removeItem(key);
          const keys = Object.keys(localStorage).filter(k => k.startsWith('layout_'));
          setSavedFiles(keys);
      }
  };

  // --- NOVAS FUNÇÕES DE EXPORTAR/IMPORTAR ARQUIVO ---

  const downloadLayoutJSON = (key: string) => {
      const savedString = localStorage.getItem(key);
      if (!savedString) return;
      
      const blob = new Blob([savedString], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${key.replace('layout_', '')}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0]) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              try {
                  const jsonContent = event.target.result as string;
                  // Validação básica
                  JSON.parse(jsonContent); 
                  
                  const layoutName = prompt('Nome para o layout importado:', e.target.files![0].name.replace('.json', ''));
                  if (layoutName) {
                      localStorage.setItem(`layout_${layoutName}`, jsonContent);
                      alert('Layout importado com sucesso!');
                      const keys = Object.keys(localStorage).filter(k => k.startsWith('layout_'));
                      setSavedFiles(keys);
                  }
              } catch (err) {
                  alert('Erro: Arquivo JSON inválido.');
              }
          }
      };
      reader.readAsText(e.target.files[0]);
      e.target.value = ''; // Reset input
  };

  const downloadSVG = () => {
    if (!fabricCanvas) return;
    
    // 1. Forçar o tamanho real da exportação para corresponder ao tamanho do papel
    const width = fabricCanvas.width!;
    const height = fabricCanvas.height!;

    const svg = fabricCanvas.toSVG({
        viewBox: {
            x: 0,
            y: 0,
            width: width,
            height: height
        },
        width: width,
        height: height
    });

    const blob = new Blob([svg], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'cartaz.svg';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(`
            <html>
                <head>
                    <title>Imprimir Cartaz</title>
                    <style>
                        body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                        img { max-width: 100%; max-height: 100%; object-fit: contain; }
                        @media print { body { display: block; } img { width: 100%; height: auto; } }
                    </style>
                </head>
                <body>
                    <img src="${dataURL}" onload="window.print();window.close()" />
                </body>
            </html>
        `);
        win.document.close();
    }
  };

  return (
    <div className="flex h-screen flex-col md:flex-row relative">
      
      {/* MODAL DE CARREGAMENTO */}
      {showLoadModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-slate-800 text-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-yellow-400">Meus Layouts</h2>
                    <button onClick={() => setShowLoadModal(false)}><X size={24} /></button>
                </div>

                <div className="mb-4 p-3 bg-slate-700 rounded-lg border border-slate-600">
                    <label className="flex items-center justify-center gap-2 cursor-pointer hover:text-yellow-400 transition">
                        <Upload size={18} /> <span className="text-sm font-bold">Importar Layout (.json)</span>
                        <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                </div>
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                    {savedFiles.length === 0 && <p className="text-slate-400 text-center py-4">Nenhum layout salvo.</p>}
                    {savedFiles.map(key => (
                        <div key={key} className="flex items-center bg-slate-700 p-3 rounded hover:bg-slate-600 transition group">
                            <FileText className="text-blue-400 mr-3" size={20} />
                            <span className="flex-1 font-medium truncate">{key.replace('layout_', '')}</span>
                            
                            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => downloadLayoutJSON(key)} className="text-slate-300 hover:text-white p-2" title="Baixar Arquivo"><Download size={16} /></button>
                                <button onClick={() => loadLayoutFile(key)} className="bg-green-600 hover:bg-green-500 p-2 rounded text-xs font-bold">ABRIR</button>
                                <button onClick={() => deleteLayoutFile(key)} className="text-red-400 hover:text-red-200 p-2"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Barra Lateral */}
      <div className="w-full md:w-80 bg-slate-900 text-white flex flex-col shadow-xl z-10 border-r border-slate-800">
        {/* ... (CONTEÚDO DA BARRA LATERAL MANTIDO IGUAL) ... */}
        <div className="p-4 pb-0">
            <h1 className="text-2xl font-bold text-yellow-400 mb-4 tracking-tighter">MARKET MAKER</h1>
            <div className="flex gap-1 bg-slate-800 p-1 rounded mb-2">
                <button onClick={() => setEditMode('design')} className={`flex-1 py-2 text-sm font-medium rounded transition ${editMode === 'design' ? 'bg-slate-600' : 'text-slate-400 hover:text-white'}`}>Designer</button>
                <button onClick={() => setEditMode('fill')} className={`flex-1 py-2 text-sm font-medium rounded transition ${editMode === 'fill' ? 'bg-blue-600' : 'text-slate-400 hover:text-white'}`}>Preencher</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {editMode === 'design' && (
                <>
                    <div className="bg-slate-800 p-3 rounded-lg space-y-2">
                        <label className="text-xs uppercase text-slate-400 font-bold block">Tamanho do Papel</label>
                        <select className="w-full bg-slate-700 p-2 rounded border border-slate-600 text-sm" value={selectedSize.label} onChange={(e) => {
                                const newSize = PRESET_SIZES.find(s => s.label === e.target.value);
                                if (newSize) setSelectedSize(newSize);
                            }}>
                            {PRESET_SIZES.map(size => <option key={size.label} value={size.label}>{size.label}</option>)}
                        </select>
                        {selectedSize.isCustom && (
                            <div className="flex gap-2">
                                <div className="flex-1"><input type="number" value={customWidth} onChange={(e) => setCustomWidth(Number(e.target.value))} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" /></div>
                                <div className="flex-1"><input type="number" value={customHeight} onChange={(e) => setCustomHeight(Number(e.target.value))} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" /></div>
                            </div>
                        )}
                        <button onClick={() => setIsLandscape(!isLandscape)} className="w-full flex items-center justify-center gap-2 bg-slate-700 p-2 rounded text-sm hover:bg-slate-600 transition"><RotateCw size={16} /> {isLandscape ? 'Paisagem (H)' : 'Retrato (V)'}</button>
                    </div>

                    <div className={`bg-slate-800 p-3 rounded-lg transition-opacity ${!selectedObject ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label className="text-xs uppercase text-slate-400 font-bold mb-2 block flex justify-between">Editar Seleção {selectedObject && <button onClick={deleteSelected} className="text-red-400 hover:text-red-300"><Trash2 size={14}/></button>}</label>
                        <div className="flex items-center gap-2 mb-2">
                            <input type="color" value={color} onChange={(e) => changeColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-none" />
                            <span className="text-xs text-slate-300">Cor do Preenchimento</span>
                        </div>
                        
                        {/* CONTROLES DE CAMADA */}
                        <div className="flex gap-2 mb-3">
                            <button onClick={() => moveLayer('up')} className="flex-1 bg-slate-700 p-2 rounded hover:bg-slate-600 flex justify-center gap-1 text-xs" title="Trazer para Frente"><ArrowUp size={14}/> Frente</button>
                            <button onClick={() => moveLayer('down')} className="flex-1 bg-slate-700 p-2 rounded hover:bg-slate-600 flex justify-center gap-1 text-xs" title="Enviar para Trás"><ArrowDown size={14}/> Trás</button>
                        </div>

                        {selectedObject instanceof fabric.Textbox && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Fonte e Tamanho</label>
                                    <div className="flex gap-2">
                                        <select className="w-2/3 bg-slate-700 p-2 rounded border border-slate-600 text-sm" value={fontFamily} onChange={(e) => changeFont(e.target.value)}>
                                            {FONTS.map(font => <option key={font} value={font} style={{fontFamily: font}}>{font}</option>)}
                                        </select>
                                        <input type="number" value={fontSize} onChange={(e) => changeFontSize(Number(e.target.value))} className="w-1/3 bg-slate-700 p-2 rounded border border-slate-600 text-sm" />
                                    </div>
                                </div>

                                {/* FORMATAÇÃO DE TEXTO */}
                                <div className="flex flex-col gap-2 bg-slate-700 p-2 rounded border border-slate-600">
                                    <div className="flex justify-between gap-1">
                                        <button onClick={toggleBold} className={`flex-1 p-2 rounded hover:bg-slate-600 ${isBold ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Negrito"><Bold size={16} className="mx-auto"/></button>
                                        <button onClick={toggleItalic} className={`flex-1 p-2 rounded hover:bg-slate-600 ${isItalic ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Itálico"><Italic size={16} className="mx-auto"/></button>
                                        <button onClick={toggleUnderline} className={`flex-1 p-2 rounded hover:bg-slate-600 ${isUnderline ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Sublinhado"><Underline size={16} className="mx-auto"/></button>
                                        <button onClick={toggleLinethrough} className={`flex-1 p-2 rounded hover:bg-slate-600 ${isLinethrough ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Riscado"><Strikethrough size={16} className="mx-auto"/></button>
                                    </div>
                                    <div className="flex justify-between gap-1 border-t border-slate-600 pt-2">
                                        <button onClick={() => changeTextAlign('left')} className={`flex-1 p-2 rounded hover:bg-slate-600 ${textAlign === 'left' ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Alinhar à Esquerda"><AlignLeft size={16} className="mx-auto"/></button>
                                        <button onClick={() => changeTextAlign('center')} className={`flex-1 p-2 rounded hover:bg-slate-600 ${textAlign === 'center' ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Centralizar"><AlignCenter size={16} className="mx-auto"/></button>
                                        <button onClick={() => changeTextAlign('right')} className={`flex-1 p-2 rounded hover:bg-slate-600 ${textAlign === 'right' ? 'bg-slate-500 text-white' : 'text-slate-400'}`} title="Alinhar à Direita"><AlignRight size={16} className="mx-auto"/></button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-yellow-400 font-bold mb-1 block">Vincular Dados</label>
                                    <select className="w-full bg-slate-900 p-2 rounded border border-yellow-600 text-sm text-yellow-100" value={dataTag} onChange={(e) => changeDataTag(e.target.value)}>
                                        {DATA_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs uppercase text-slate-400 font-bold">Ferramentas</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => addText('TEXTO', 80)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded flex justify-center"><Type size={18}/></button>
                            <button onClick={() => addText('9,99', 120, '#c00')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded flex justify-center text-red-400 font-bold text-lg">9,99</button>
                            <button onClick={addRect} className="p-3 bg-slate-800 hover:bg-slate-700 rounded flex justify-center"><Square size={18}/></button>
                            <button onClick={addCircle} className="p-3 bg-slate-800 hover:bg-slate-700 rounded flex justify-center"><div className="w-4 h-4 rounded-full border-2 border-white"></div></button>
                        </div>
                        <label className="w-full flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer border border-dashed border-slate-600">
                            <ImageIcon size={16} /> <span className="text-xs">Imagem/Logo</span>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                         <label className="w-full flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer border border-dashed border-slate-600">
                            <Upload size={16} /> <span className="text-xs">Importar SVG</span>
                            <input type="file" accept=".svg" onChange={handleSVGUpload} className="hidden" />
                        </label>
                    </div>
                </>
            )}

            {editMode === 'fill' && (
                <div className="space-y-4">
                    <div className="bg-blue-900/30 p-3 rounded border border-blue-800 text-xs text-blue-200 flex justify-between items-center">
                        <span>Campos Automáticos</span>
                        <button onClick={scanFields} className="p-1 hover:bg-blue-800 rounded" title="Recarregar Campos"><RefreshCw size={14}/></button>
                    </div>
                    {formFields.length === 0 ? (
                        <p className="text-slate-500 text-center text-sm py-8">
                            Nenhum campo vinculado encontrado.<br/>
                            1. Vá em Designer.<br/>
                            2. Selecione um texto.<br/>
                            3. Escolha "Vincular Dados".<br/>
                            4. Salve e recarregue.
                        </p>
                    ) : (
                        formFields.map((field) => (
                            <div key={field.id}>
                                <label className="text-xs uppercase text-slate-400 font-bold mb-1 block">{field.label}</label>
                                <input className="w-full bg-slate-800 p-3 rounded border border-slate-600 text-white focus:border-blue-500 outline-none" value={field.value} onChange={(e) => updateFieldValue(field.id, e.target.value)} />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-2">
             <div className="grid grid-cols-2 gap-2">
                <button onClick={saveLayout} className="flex items-center justify-center gap-2 p-2 bg-green-700 hover:bg-green-600 rounded text-sm font-semibold transition">
                    <Save size={16} /> Salvar
                </button>
                <button onClick={openLoadModal} className="flex items-center justify-center gap-2 p-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold transition">
                    <FolderOpen size={16} /> Meus Layouts
                </button>
           </div>
           <div className="flex gap-2">
                <button onClick={downloadSVG} className="flex-1 bg-blue-600 hover:bg-blue-500 p-3 rounded font-bold flex items-center justify-center gap-2 transition shadow-lg text-sm">
                        <Download size={18} /> Exportar
                </button>
                <button onClick={handlePrint} className="flex-1 bg-purple-600 hover:bg-purple-500 p-3 rounded font-bold flex items-center justify-center gap-2 transition shadow-lg text-sm">
                        <Printer size={18} /> Imprimir
                </button>
           </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 overflow-auto p-8 flex justify-center items-start relative">
        <div className="shadow-2xl border border-gray-400 bg-white">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
};
