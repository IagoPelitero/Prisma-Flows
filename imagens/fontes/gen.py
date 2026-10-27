import html
E = ["#6E4BD8","#3B5BDB","#1785BD","#1F9467","#C49000","#DD6519","#D23B3B"]
AV = ["#6E4BD8","#1785BD","#1F9467","#DD6519","#D23B3B","#3B5BDB"]
def av(n, i=None, p=False):
    ini = "".join(w[0] for w in n.split()[:2]).upper()
    c = AV[(i if i is not None else sum(map(ord,n))) % len(AV)]
    return f'<span class="av{" p" if p else ""}" style="background:{c}" title="{n}">{ini}</span>'

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{width:1600px;height:900px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;color:#162033;background:#EEF0F5;position:relative;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;background:
 radial-gradient(900px 600px at 8% 0%, rgba(110,75,216,.13), transparent 60%),
 radial-gradient(900px 600px at 100% 100%, rgba(221,101,25,.12), transparent 60%),#EEF0F5}
.faixa{position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,#6E4BD8,#3B5BDB,#1785BD,#1F9467,#C49000,#DD6519,#D23B3B)}
.marca{position:absolute;left:72px;top:56px;display:flex;align-items:center;gap:12px;font-weight:700;font-size:26px;letter-spacing:-.01em}
.marca small{font-weight:500;color:#5F6B80;font-size:15px;margin-left:6px;padding-left:14px;border-left:1.5px solid #C5CCD8}
.txt{position:absolute;left:72px;top:180px;width:560px}
.chip{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:99px;background:#fff;border:1px solid #D3D9E2;font-size:15px;font-weight:600;color:#2B44C4;margin-bottom:26px}
.chip i{width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#6E4BD8,#D23B3B)}
h1{font-size:60px;line-height:1.04;letter-spacing:-.03em;font-weight:800}
h1 em{font-style:normal;background:linear-gradient(90deg,#6E4BD8,#3B5BDB 40%,#1785BD);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:26px;font-size:23px;line-height:1.45;color:#4C586C;font-weight:450}
.pts{margin-top:34px;display:flex;flex-direction:column;gap:14px}
.pts div{display:flex;align-items:center;gap:12px;font-size:19px;font-weight:600;color:#162033}
.pts b{width:26px;height:26px;border-radius:8px;background:#E2F3E9;color:#1B7A4B;display:grid;place-items:center;font-size:15px}
.cena{position:absolute;left:690px;top:70px;width:850px;height:760px;display:flex;flex-direction:column;justify-content:center}
.cena>.card.fill{flex:1}
.card{background:#fff;border:1px solid #D3D9E2;border-radius:18px;box-shadow:0 30px 60px -24px rgba(22,32,51,.35),0 2px 6px rgba(22,32,51,.08)}
.av{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;color:#fff;font-size:11.5px;font-weight:700;border:2px solid #fff;flex:none}
.av.p{width:26px;height:26px;font-size:9.5px}
.av + .av{margin-left:-3px}
.etq{display:inline-block;height:9px;width:38px;border-radius:5px}
.tag{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;font-size:12.5px;font-weight:700}
.alta{background:#FFF2D2;color:#855700}.urg{background:#FBE9E9;color:#B42828}.ok{background:#E2F3E9;color:#1B7A4B}.az{background:#E8ECFB;color:#2B44C4}.cz{background:#EEF0F5;color:#4C586C}
.btn{display:inline-block;padding:9px 18px;border-radius:10px;font-weight:700;font-size:14px}
.pri{background:#2B44C4;color:#fff}.sut{background:#EEF0F5;color:#162033;border:1px solid #D3D9E2}
"""
LOGO = '<svg width="38" height="32" viewBox="0 0 38 32"><path d="M2 17 13 15.5" stroke="#162033" stroke-width="2.4" stroke-linecap="round"/><path d="M18 3 31 27H5Z" fill="#fff" stroke="#162033" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 14l11-6M25.5 18l11-1.5M27 22l10 4" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M24 14l11-6" stroke="#6E4BD8"/><path d="M25.5 18l11-1.5" stroke="#1785BD"/><path d="M27 22l10 4" stroke="#D23B3B"/></svg>'

def page(chip, h1, sub, pts, scene, n):
    p = "".join(f'<div><b>✓</b>{html.escape(x)}</div>' for x in pts)
    return f"""<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>{CSS}</style><body>
<div class="bg"></div><div class="faixa"></div>
<div class="marca">{LOGO}Prisma Flows<small>Pelitero Labs</small></div>
<div class="txt"><div class="chip"><i></i>{chip}</div><h1>{h1}</h1><p class="sub">{sub}</p><div class="pts">{p}</div></div>
<div class="cena">{scene}</div></body></html>"""

# ---------- 1. KANBAN ----------
def cartao(t, etq, resp, prazo=None, prio=None, chk=None, feito=False):
    e = "".join(f'<span class="etq" style="background:{c}"></span>' for c in etq)
    meta = ""
    if prio: meta += f'<span class="tag {"urg" if prio=="Urgente" else "alta"}">{prio}</span>'
    if prazo: meta += f'<span class="tag cz">📅 {prazo}</span>'
    if chk: meta += f'<span class="tag {"ok" if chk[0]==chk[1] else "cz"}">☑ {chk[0]}/{chk[1]}</span>'
    a = "".join(av(r, p=True) for r in resp)
    return f'<div style="background:#fff;border:1px solid #D3D9E2;border-radius:12px;padding:12px 13px;box-shadow:0 1px 2px rgba(22,32,51,.07);{"opacity:.72" if feito else ""}"><div style="display:flex;gap:5px;margin-bottom:8px">{e}</div><div style="font-size:14.5px;font-weight:600;line-height:1.3;{"text-decoration:line-through;color:#5F6B80" if feito else ""}">{t}</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px"><div style="display:flex;gap:6px;flex-wrap:wrap">{meta}</div><div style="display:flex">{a}</div></div></div>'
def lista(nome, cor, n, lim, cards):
    over = lim and n > lim
    return f'<div style="flex:1;background:#F1F3F7;border-radius:14px;padding:0 0 10px;border-top:5px solid {cor};min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;padding:13px 14px 11px"><b style="font-size:15px">{nome}</b><span class="tag {"urg" if over else "cz"}">{n}{"/"+str(lim) if lim else ""}</span></div><div style="display:flex;flex-direction:column;gap:10px;padding:0 10px">{"".join(cards)}</div></div>'
kanban = f"""<div class="card fill" style="overflow:hidden">
<div style="display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid #D3D9E2"><span style="width:14px;height:14px;border-radius:5px;background:#3B5BDB"></span><b style="font-size:20px">Retenção Vida individual</b><span class="tag cz">Toda a equipe</span><span style="margin-left:auto;display:flex">{av("Ana Souza")}{av("Carla Mendes")}{av("Diego Alves")}{av("Bruno Lima")}</span></div>
<div style="display:flex;gap:14px;padding:18px;height:calc(100% - 66px);background:#E6E9EF">
{lista("Entrada",E[0],3,None,[cartao("Proposta 7781: corretor pediu contraproposta",[E[3],E[5]],["Ana Souza"],"10/10","Alta",(1,3)),cartao("Cancelamento apólice 4412",[E[6]],["Carla Mendes"],"09/10","Urgente"),cartao("Revisar cobertura adicional",[E[1]],["Diego Alves"],"14/10")])}
{lista("Em contato",E[1],4,5,[cartao("Simulação enviada ao cliente",[E[3]],["Carla Mendes","Ana Souza"],"11/10",None,(2,4)),cartao("Aguardando retorno do corretor",[E[4]],["Bruno Lima"]),cartao("Ajuste de prêmio",[E[5],E[1]],["Ana Souza"],"12/10","Alta"),cartao("Reunião com a regional",[E[2]],["Diego Alves"],"15/10")])}
{lista("Proposta",E[2],2,None,[cartao("Contraproposta aprovada",[E[3]],["Ana Souza"],"13/10",None,(3,3)),cartao("Documentos pendentes",[E[4]],["Carla Mendes"],"16/10",None,(1,5))])}
{lista("Concluído",E[3],2,None,[cartao("Retenção apólice 3098",[E[3]],["Bruno Lima"],None,None,(4,4),True),cartao("Atualização cadastral",[E[2]],["Diego Alves"],None,None,None,True)])}
</div></div>"""

# ---------- 2. ESCALA ----------
def linha_escala(front, cor, vagas, pessoas):
    rows = ""
    for pos, nome, rec, estado in pessoas:
        badge = {"vez":'<span class="tag az">▶ Na vez</span>',"ok":'<span class="tag cz">Aguardando</span>',"aus":'<span class="tag alta">Férias · pulado</span>'}[estado]
        op = "opacity:.55" if estado=="aus" else ""
        hl = "background:#E8ECFB;border-color:#B8C4F2" if estado=="vez" else "background:#fff"
        rows += f'<div style="display:flex;align-items:center;gap:14px;padding:11px 14px;border:1px solid #D3D9E2;border-radius:12px;{hl};{op}"><b style="width:26px;color:#5F6B80;font-size:15px">{pos}º</b>{av(nome)}<b style="font-size:16px;flex:1">{nome}</b>{badge}<span style="width:92px;text-align:right;font-size:14px;color:#4C586C"><b style="font-size:20px;color:#162033">{rec}</b> casos</span></div>'
    return f'<div style="margin-bottom:18px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="width:12px;height:12px;border-radius:4px;background:{cor}"></span><b style="font-size:17px">{front}</b><span class="tag cz">{vagas}</span></div><div style="display:flex;flex-direction:column;gap:8px">{rows}</div></div>'
escala = f"""<div class="card" style="padding:30px 30px 32px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"><div><div style="font-size:13px;font-weight:700;color:#5F6B80;letter-spacing:.06em">ESCALA DA SEMANA</div><b style="font-size:23px">Semana de 05/10 a 09/10</b></div><span class="tag ok">Montada automaticamente</span></div>
{linha_escala("Frente Retenção",E[1],"2 vagas",[(1,"Ana Souza",7,"ok"),(2,"Carla Mendes",6,"vez"),(3,"Diego Alves",0,"aus")])}
{linha_escala("Frente Cancelamento",E[5],"2 vagas",[(1,"Bruno Lima",4,"vez"),(2,"Marina Reis",5,"ok")])}
<div style="margin-top:6px;padding:14px 16px;background:#F1F3F7;border-radius:12px;font-size:15px;color:#4C586C;line-height:1.5"><b style="color:#162033">Novo caso sem responsável</b> entra na frente e vai direto para quem está na vez. Quem está ausente no dia é pulado.</div>
</div>"""

# ---------- 3. ROTINAS ----------
def rot(nome, freq, ativo=True, mod=""):
    return f'<div style="display:flex;align-items:center;gap:12px;padding:13px 15px;border:1px solid #D3D9E2;border-radius:12px;background:#fff"><span style="width:34px;height:34px;border-radius:10px;background:#E8ECFB;color:#2B44C4;display:grid;place-items:center;font-size:17px">⟳</span><div style="flex:1"><b style="font-size:15.5px">{nome}</b><div style="font-size:13.5px;color:#5F6B80;margin-top:2px">{freq}</div></div><span class="tag {"ok" if ativo else "cz"}">{"Ativa" if ativo else "Pausada"}</span></div>'
rotinas = f"""<div style="display:flex;gap:22px;align-items:center">
<div class="card" style="flex:1.05;padding:22px;display:flex;flex-direction:column;gap:11px"><div style="font-size:13px;font-weight:700;color:#5F6B80;letter-spacing:.06em;margin-bottom:2px">ROTINAS</div>
{rot("Atualizar painel de vendas — {mes}","Dias úteis · responsável fixo")}{rot("Fechamento do mês","Mensal · último dia útil")}{rot("Reunião de alinhamento","Semanal · terça e quinta")}{rot("Conferir pendências da regional","Diária · na vez da escala")}{rot("Relatório de férias","Mensal · dia 20",False)}
<div class="btn pri" style="align-self:flex-start;margin-top:6px">Ligar criação diária</div></div>
<div style="font-size:34px;color:#6E4BD8;font-weight:800">➜</div>
<div class="card" style="flex:.95;padding:20px;border-top:5px solid {E[1]}"><div style="display:flex;gap:6px;margin-bottom:10px"><span class="etq" style="background:{E[1]}"></span><span class="etq" style="background:{E[3]}"></span></div><b style="font-size:19px;line-height:1.25">Atualizar painel de vendas — 10/2026</b>
<div style="display:flex;gap:7px;margin:12px 0 14px"><span class="tag cz">📅 Prazo em 2 dias</span><span class="tag az">⟳ Rotina</span></div>
<div style="font-size:14px;color:#4C586C;margin-bottom:12px">Onde fazer: planilha de vendas, pasta Painel.</div>
<div style="display:flex;flex-direction:column;gap:9px;font-size:15px;font-weight:550">{"".join(f'<div style="display:flex;gap:10px;align-items:center"><span style="width:20px;height:20px;border-radius:6px;border:2px solid #B5BECC"></span>{t}</div>' for t in ["Baixar relatório","Atualizar abas","Conferir totais","Avisar a coordenação"])}</div>
<div style="margin-top:16px;display:flex;align-items:center;gap:8px;font-size:13px;color:#5F6B80">{av("Ana Souza",p=True)} Ana Souza · criado hoje às 06:00 por Rotinas</div></div></div>"""

# ---------- 4. EQUIPE (home/presencial) ----------
def cel(h): 
    return f'<div style="display:grid;place-items:center;height:46px;border-radius:10px;{"background:#E8ECFB;color:#2B44C4;font-weight:700" if h else "background:#F1F3F7;color:#5F6B80"};font-size:14px">{"🏠 Home" if h else "Presencial"}</div>'
pessoas = [("Ana Souza",[0,1,0,1,0]),("Carla Mendes",[1,0,0,0,1]),("Diego Alves",[0,0,1,1,0]),("Bruno Lima",[1,0,1,0,0]),("Marina Reis",[0,1,1,0,0])]
dias = ["Seg 12","Ter 13","Qua 14","Qui 15","Sex 16"]
pres = [sum(1 for _,d in pessoas if not d[i]) for i in range(5)]
equipe = f"""<div class="card" style="padding:30px 30px 32px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px"><div><div style="font-size:13px;font-weight:700;color:#5F6B80;letter-spacing:.06em">EQUIPE · SEMANA</div><b style="font-size:23px">Home e presencial</b></div><span class="tag az">Cota: 2 dias de home</span></div>
<div style="display:grid;grid-template-columns:170px repeat(5,1fr);gap:8px;align-items:center">
<div></div>{"".join(f'<div style="text-align:center;font-weight:700;font-size:14.5px;color:#4C586C">{d}</div>' for d in dias)}
{"".join(f'<div style="display:flex;align-items:center;gap:10px;font-weight:650;font-size:15px">{av(n)}{n.split()[0]}</div>'+"".join(cel(h) for h in d) for n,d in pessoas)}
<div style="font-size:14px;font-weight:700;color:#5F6B80">Presenciais</div>
{"".join(f'<div style="text-align:center"><span class="tag {"urg" if p<3 else "ok"}" style="font-size:15px;padding:5px 14px">{p}{" ⚠" if p<3 else ""}</span></div>' for p in pres)}</div>
<div style="margin-top:24px;padding:14px 16px;background:#FFF2D2;border-radius:12px;font-size:15px;color:#855700;line-height:1.5"><b>Aviso:</b> na quarta-feira há só {pres[2]} pessoas presenciais. O mínimo configurado é 3.</div>
</div>"""

# ---------- 5. BANCO DE HORAS ----------
def lanc(data, tipo, desc, mins, status, nome):
    cor = "ok" if tipo=="Crédito" else "urg"
    sinal = "+" if tipo=="Crédito" else "−"
    st = {"Aprovado":"ok","Pendente":"alta","Recusado":"urg"}[status]
    h = f"{mins//60}h{mins%60:02d}"
    return f'<div style="display:flex;align-items:center;gap:14px;padding:13px 15px;border:1px solid #D3D9E2;border-radius:12px;background:#fff"><div style="width:62px;font-size:14px;color:#5F6B80;font-weight:600">{data}</div><span class="tag {cor}" style="width:74px;justify-content:center">{tipo}</span><div style="flex:1"><b style="font-size:15.5px">{desc}</b><div style="font-size:13px;color:#5F6B80">{nome}</div></div><b style="font-size:18px;width:70px;text-align:right">{sinal}{h}</b><span class="tag {st}" style="width:88px;justify-content:center">{status}</span></div>'
banco = f"""<div style="display:flex;flex-direction:column;gap:18px">
<div style="display:flex;gap:18px">
<div class="card" style="flex:1;padding:22px 24px"><div style="font-size:13px;font-weight:700;color:#5F6B80;letter-spacing:.06em">MEU SALDO</div><div style="font-size:54px;font-weight:800;letter-spacing:-.03em;color:#1B7A4B;margin-top:4px">+2h30</div><div style="font-size:14px;color:#5F6B80">Só entra o que foi aprovado</div></div>
<div class="card" style="flex:1;padding:22px 24px"><div style="font-size:13px;font-weight:700;color:#5F6B80;letter-spacing:.06em">AGUARDANDO APROVAÇÃO</div><div style="font-size:54px;font-weight:800;letter-spacing:-.03em;color:#855700;margin-top:4px">2</div><div style="display:flex;gap:8px;margin-top:6px"><span class="btn pri">Aprovar</span><span class="btn sut">Recusar</span></div></div></div>
<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:11px"><div style="font-size:13px;font-weight:700;color:#5F6B80;letter-spacing:.06em;margin-bottom:2px">LANÇAMENTOS</div>
{lanc("05/10","Crédito","Fechamento do trimestre",240,"Aprovado","Carla Mendes")}{lanc("07/10","Débito","Saída antecipada",90,"Aprovado","Carla Mendes")}{lanc("09/10","Crédito","Plantão de sábado",180,"Pendente","Carla Mendes")}{lanc("12/10","Débito","Consulta médica",120,"Pendente","Diego Alves")}{lanc("13/10","Crédito","Treinamento fora do horário",60,"Recusado","Bruno Lima")}
</div></div>"""

PAGES = [
 ("quadros", page("Quadros Kanban", "Todo o trabalho da equipe, <em>num só quadro</em>", "Listas, cartões, checklists e prazos no estilo Trello, direto no Google Planilhas.", ["Cartões com responsável, prazo e etiquetas","Limite de cartões por lista (WIP)","Tudo salvo na sua planilha"], kanban, 1)),
 ("escala", page("Escala da semana", "Cada caso novo na <em>vez certa</em>", "O rodízio monta a semana toda segunda e distribui os casos entre quem está disponível.", ["Frentes com vagas por semana","Ausências puladas automaticamente","Ajuste manual pela coordenação"], escala, 2)),
 ("rotinas", page("Rotinas", "O que se repete <em>nasce sozinho</em>", "Cadastre uma vez. No dia certo o cartão aparece com responsável, prazo e checklist.", ["Diária, dias úteis, semanal ou mensal","Nunca cria o mesmo cartão duas vezes","Responsável fixo ou na vez da escala"], rotinas, 3)),
 ("equipe", page("Equipe", "Home e presencial, <em>sem planilha paralela</em>", "A coordenação marca quem está em home e o sistema avisa quando faltam pessoas no escritório.", ["Cota de dias de home por pessoa","Aviso de mínimo de presenciais","Visão da semana em uma tela"], equipe, 4)),
 ("banco-de-horas", page("Banco de horas", "Crédito e débito com <em>aprovação</em>", "A pessoa pede, a coordenação decide e só o aprovado entra no saldo.", ["Saldo individual e da equipe","Histórico de cada lançamento","Controle interno, sem substituir o ponto"], banco, 5)),
]
for i,(slug,h) in enumerate(PAGES, 1):
    open(f"{i:02d}-{slug}.html","w",encoding="utf-8").write(h)
print(len(PAGES))
