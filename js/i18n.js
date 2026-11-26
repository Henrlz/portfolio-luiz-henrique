/* Tradução do site (pt-BR / en / es).
   Cada elemento traduzível carrega data-i18n (conteúdo), data-i18n-title ou
   data-i18n-aria (atributos). O texto em português continua no HTML, então a
   página já nasce legível mesmo se este script não carregar. */
(function () {
  var STORAGE_KEY = 'lang';
  var FALLBACK = 'pt';

  var FLAGS = {
    pt: '<svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" fill="#009b3a"/><path d="M14 2.6 25.4 10 14 17.4 2.6 10z" fill="#fedf00"/><circle cx="14" cy="10" r="4.2" fill="#002776"/><path d="M10.6 11.5c2.6-1.5 5.4-1.4 7.4.2" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>',
    en: '<svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" fill="#fff"/><g fill="#b22234"><rect y="0" width="28" height="1.54"/><rect y="3.08" width="28" height="1.54"/><rect y="6.15" width="28" height="1.54"/><rect y="9.23" width="28" height="1.54"/><rect y="12.31" width="28" height="1.54"/><rect y="15.38" width="28" height="1.54"/><rect y="18.46" width="28" height="1.54"/></g><rect width="11.2" height="10.77" fill="#3c3b6e"/><g fill="#fff"><circle cx="2" cy="2" r="0.7"/><circle cx="5.6" cy="2" r="0.7"/><circle cx="9.2" cy="2" r="0.7"/><circle cx="3.8" cy="4.2" r="0.7"/><circle cx="7.4" cy="4.2" r="0.7"/><circle cx="2" cy="6.4" r="0.7"/><circle cx="5.6" cy="6.4" r="0.7"/><circle cx="9.2" cy="6.4" r="0.7"/><circle cx="3.8" cy="8.6" r="0.7"/><circle cx="7.4" cy="8.6" r="0.7"/></g></svg>',
    es: '<svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" fill="#c60b1e"/><rect y="5" width="28" height="10" fill="#ffc400"/></svg>'
  };

  var LANGS = [
    { code: 'pt', label: 'Português', htmlLang: 'pt-BR' },
    { code: 'en', label: 'English', htmlLang: 'en' },
    { code: 'es', label: 'Español', htmlLang: 'es' }
  ];

  var DICT = {
    pt: {
      'meta.title': 'Luiz Henrique | Desenvolvedor',
      'meta.description': 'Portfólio de Luiz Henrique: desenvolvimento back-end, front-end, automações, ferramentas e banco de dados.',

      'nav.home': 'Início',
      'nav.about': 'Sobre',
      'nav.skills': 'Habilidades',
      'nav.history': 'Histórico',
      'nav.projects': 'Projetos',
      'nav.contact': 'Contato',

      'a11y.theme': 'Alternar tema claro/escuro',
      'a11y.theme_title': 'Alternar tema',
      'a11y.menu': 'Abrir menu',
      'a11y.scroll': 'Rolar para a seção Sobre',
      'a11y.lang': 'Escolher idioma',
      'a11y.loading': 'Carregando',

      'hero.greeting': 'Olá, eu sou',
      'hero.desc': 'Trabalho com desenvolvimento back-end, front-end, automações e banco de dados, criando soluções práticas para o dia a dia, de sites a sistemas internos.',
      'hero.cta_contact': 'Entrar em contato',
      'hero.cta_projects': 'Ver projetos',
      'hero.cta_cv': 'Ver currículo',
      'cv.download': 'Baixar currículo (PDF)',
      'cv.file': 'assets/curriculo/Luiz-Henrique-Pereira-Curriculo-PT.pdf',
      'cv.file_alt': 'assets/curriculo/Luiz-Henrique-Pereira-Resume-EN.pdf',

      'about.title': 'Sobre',
      'about.p1': 'Sou técnico em informática, formado com forte atuação prática em banco de dados, e hoje curso Bacharelado em Ciência da Computação pela Uninter, com foco em desenvolvimento.',
      'about.p2': 'Atuo profissionalmente como Analista de Desenvolvimento na IRKO Campinas. Gosto de resolver problemas com código: automatizar tarefas repetitivas, construir ferramentas internas e desenvolver sistemas do zero.',

      'skills.title': 'Habilidades',
      'skills.intro': 'Conhecimentos organizados por área, em constante atualização.',
      'skills.tools': 'Ferramentas',
      'skills.database': 'Banco de Dados',
      'skills.ai': 'IA',
      'skills.responsive': 'Responsividade',
      'skills.logic': 'Lógica de programação',
      'skills.task_automation': 'Automação de tarefas',
      'skills.terminal': 'Terminal / linha de comando',
      'skills.data_modeling': 'Modelagem de dados',
      'skills.queries': 'Consultas e otimização',

      'history.title': 'Histórico',
      'history.1.tag': 'Formação',
      'history.1.title': 'Técnico em Informática',
      'history.1.desc': 'Formação técnica com atuação prática forte em banco de dados.',
      'history.2.tag': 'Cursos · Hashtag, Cisco e SENAI',
      'history.2.title': 'Redes, IA, Git &amp; GitHub e Lógica',
      'history.2.desc': 'Conceitos Básicos de Redes (Cisco Networking Academy com a UNINTER), Inteligência Artificial Impressionador (56 h), Git e GitHub, Algoritmos e Lógica de Programação, além de cursos de TIC e comunicação.',
      'history.3.tag': 'Atual · IRKO Campinas',
      'history.3.title': 'Analista de Desenvolvimento',
      'history.3.desc': 'Atuação no time de desenvolvimento, com foco em sistemas internos e automações.',
      'history.4.tag': 'Em andamento · Uninter',
      'history.4.title': 'Bacharelado em Ciência da Computação',
      'history.4.desc': 'Graduação em andamento, com foco de estudos voltado para desenvolvimento de software.',

      'projects.title': 'Projetos',
      'projects.intro': 'Alguns projetos desenvolvidos no trabalho e por conta própria.',
      'projects.tag.freelance': 'Freelance',
      'projects.tag.professional': 'Profissional',
      'projects.tag.personal': 'Pessoal',
      'projects.link_online': 'Ver online',
      'projects.preview': 'Prévia',
      'projects.preview_close': 'Fechar',
      'projects.preview_open': 'Abrir o projeto',
      'projects.preview_prev': 'Projeto anterior',
      'projects.preview_next': 'Próximo projeto',
      'projects.preview_shot': 'Tela de',
      'projects.preview_hint': '← → trocam de projeto · Esc fecha',
      'projects.gourmet.short': 'Loja virtual de pipoca gourmet feita sob encomenda: catálogo, montador de baldes, carrinho com pedido pelo WhatsApp e um painel para a própria cliente cuidar do cardápio.',
      'projects.receivables.short': 'Monta o borderô de títulos a receber: importa a planilha de receita, casa cada cliente com o cadastro, confere CNPJ e conta contábil e gera o arquivo do ERP.',
      'projects.fiscal.short': 'Apuração de vendas por canal que nasceu em VBA: demonstrativo com trocas, descontos e tributos, e uma conferência que aponta o que olhar antes de fechar o mês.',
      'projects.cedro.short': 'Loja de móveis navegada pela planta do showroom, com peças desenhadas em escala e uma calculadora que diz se o móvel cabe no seu cômodo. <em>(admin: <code>admin</code> / <code>cedrodecor2026</code>)</em>',
      'projects.clinic.short': 'Agenda de psicóloga na hora clínica de 50 minutos: fecha a sessão com presença, falta cobrada ou abonada, nota privada e pagamento, e tem modo discreto para quando alguém olha a tela.',
      'projects.wedding.short': 'Caderno a dois para planejar o casamento pelos meses que faltam: tarefas, parcelas e quanto guardar em cada mês, convidados contados por pessoa e o roteiro do dia. <em>(código de acesso: 0809)</em>',
      'projects.tattoo.short': 'Site editorial e monocromático para um estúdio de tatuagem, com galeria filtrável, lightbox e agendamento pelo WhatsApp.',
      'projects.fuel.short': 'Etanol ou gasolina, montado como um pátio de posto: calcula o limite certo para o consumo do seu carro e simula o abastecimento.',
      'projects.prato.short': 'App de calorias, nutrientes e água com cara de app de saúde: questionário guiado, alimentos filtrados pelo seu perfil de saúde, refeições do seu jeito e leitura da tabela nutricional por foto. Instala no celular.',
      'projects.abnt.short': 'Formata trabalhos de faculdade na ABNT ou na APA 7: lê Word, PDF ou texto, monta capa, sumário e referências e aponta o que está fora da norma.',
      'projects.steno.short': 'Transcreve uma live do YouTube e anota as palavras-chave quando o palestrante anuncia, sem instalar nada.',

      'projects.gourmet.icon': 'Pipoca gourmet',
      'projects.gourmet.desc': 'Loja virtual para uma marca de pipoca gourmet, desenvolvida sob encomenda. Catálogo de sabores por categoria (Tradicionais e VIP), um montador de baldes personalizados (tamanho, quantidade e até 2 sabores à escolha), carrinho de compras completo com controle de quantidade e subtotal, e finalização de pedido direto pelo WhatsApp. Inclui um painel administrativo com autenticação, onde a própria cliente cadastra, edita e remove sabores (com upload de foto) do catálogo sem precisar de mim para cada alteração. O upload passa por uma função serverless que valida a sessão antes de gravar no Supabase Storage, sem expor nenhuma chave sensível no navegador.',

      'projects.receivables.icon': 'Contas a receber',
      'projects.receivables.title': 'Emissão de Contas a Receber',
      'projects.receivables.desc': 'Ferramenta interna de emissão de contas a receber. Os títulos entram à mão (com parcelamento mensal) ou pela planilha de receita que chega do exterior, onde cada nome de cliente é casado com um destinatário pelas suas chaves; o que não casa você vincula uma vez e ele aprende. Cada título aparece como um canhoto com o dia do vencimento e acusa CNPJ inválido, falta de conta contábil, vencimento antes da emissão, fim de semana e possível duplicidade. Uma faixa de calendário mostra onde o dinheiro concentra. Ao emitir, baixa o arquivo no layout de importação do ERP e guarda o borderô carimbado no arquivo, com o retrato do cadastro daquele dia. Reescrita do zero para o portfólio. <em>(demo com dados fictícios)</em>',

      'projects.fiscal.icon': 'Análise fiscal',
      'projects.fiscal.desc': 'Começou como uma macro em VBA e virou sistema. Lê o livro de saída, o de entrada (de onde saem as devoluções) e as notas de serviço, classifica cada item num canal por regras de empresa, série e CFOP e monta o demonstrativo: vendas, trocas, descontos, ICMS, PIS, COFINS, DIFAL e vendas líquidas. A conferência acusa CFOP fora da lista, ICMS efetivo fora da faixa e devolução sem venda no período; a ficha de cada lançamento explica qual regra o classificou; e a importação acha o cabeçalho sozinha e mostra o mapeamento de colunas antes de gravar. Esta versão foi reescrita do zero para o portfólio. <em>(demo com dados fictícios)</em>',

      'projects.cedro.icon': 'Loja de móveis em planta',
      'projects.cedro.desc': 'Loja de móveis navegada pela <strong>planta baixa do showroom</strong>: em vez de menu, você clica num ambiente e um marcador caminha pelo corredor até ele. Os móveis são desenhados em escala a partir das medidas cadastradas — a mesma fonte alimenta a planta, a ficha técnica com cotas e a calculadora “vai caber?”, que compara a peça com o cômodo da pessoa e diz quanta folga sobra. Tem filtro por cor, aviso de estoque baixo e painel para gerenciar peças, depoimentos e visitas. <em>(login do admin: usuário <code>admin</code>, senha <code>cedrodecor2026</code>)</em>',

      'projects.clinic.icon': 'Gestão clínica',
      'projects.clinic.title': 'Consultório',
      'projects.clinic.desc': 'Feito a partir da rotina de uma psicóloga, sem tela de login nem cadastro: abre direto na semana. Cada paciente tem cor e horário fixo (semanal ou quinzenal) e a agenda marca encaixes, faltas e desmarcações. Ao clicar numa sessão, um painel fecha o atendimento: realizada, falta cobrada pela política de 24 horas ou abonada, nota privada e pagamento na hora. A ficha do paciente junta o prontuário em linha do tempo e a conta corrente com saldo; o financeiro do mês separa o que é do mês do que está atrasado e imprime recibo com valor por extenso. O modo discreto troca nomes por iniciais e borra as notas. Reescrito do zero para o portfólio. <em>(demo com pacientes e notas fictícios)</em>',

      'projects.wedding.icon': 'Planner de casamento',
      'projects.wedding.desc': 'Organizado do jeito que casamento se planeja de verdade: pelos meses que faltam. A tela principal é o caminho de hoje até o dia, com as tarefas de cada mês (de quem é cada uma), as parcelas de fornecedor que vencem e o que ficou para trás. Convidados são separados por lado e contados por pessoa, com acompanhantes, crianças, resposta de presença e o limite do salão; dá para colar uma lista de nomes de uma vez. O dinheiro compara previsto, contratado e pago por categoria e calcula quanto guardar por mês. Fornecedores andam de pesquisando a contratado, e o dia tem locais, roteiro hora a hora e contatos de emergência. Reescrito do zero para o portfólio. <em>(casal fictício, código de acesso: 0809)</em>',
      'projects.invite.icon': 'Convite',
      'projects.invite.title': 'Convite de formatura',
      'projects.invite.short': 'Convite de formatura em forma de site: uma pergunta com um botão de não que foge, confete e o convite com contagem regressiva e mapa.',
      'projects.invite.desc': 'Feito para a formatura da minha noiva. Abre perguntando se a pessoa já tem compromisso no dia; o botão de não foge a cada tentativa, com recados, enquanto o sim cresce. O sim estoura confete e mostra o Agora tem! com efeito de carimbo, e depois o convite monta a arte original em bilhetes de papel com fita: foto, data, local com link para o mapa, contagem regressiva e um botão que salva o evento na agenda (.ics). Animações em CSS e canvas, sem bibliotecas, pensado para abrir pelo celular a partir do WhatsApp.',

      'projects.tattoo.icon': 'Estúdio de tatuagem',
      'projects.fuel.icon': 'Etanol ou gasolina',
      'projects.prato.icon': 'Contador de calorias',
      'projects.abnt.icon': 'Trabalhos nas normas da ABNT',
      'projects.steno.icon': 'Anota a palavra-chave da live',

      'projects.automations_title': 'Automações · Power Automate',
      'projects.automations_intro': 'Fluxos de automação desenvolvidos com o Power Automate, integrados a outras ferramentas do dia a dia. Sem interface própria, mas ainda assim desenvolvimento.',

      'projects.planner.icon': 'Aprovação de tarefas',
      'projects.planner.title': 'Aprovação de Tarefas no Planner',
      'projects.planner.desc': 'Fluxo integrado ao Microsoft Planner: as tarefas são criadas automaticamente a partir das respostas de um Microsoft Forms, usadas como variáveis para definir tipo, prioridade e demais campos da tarefa. Ao finalizar uma tarefa, o Power Automate dispara uma solicitação de aprovação (Approvals) e, conforme o resultado da validação, ela é movida sozinha para o bucket de finalizadas ou devolvida para execução, em caso de reprovação.',

      'projects.omie.icon': 'Estoque',
      'projects.omie.title': 'Automação de Estoque no Omie',
      'projects.omie.desc': 'Fluxo que reproduz automaticamente os cliques e ajustes manuais de movimentação de estoque no ERP Omie, eliminando a necessidade de um operador realizar esses lançamentos um a um.',

      'contact.title': 'Contato',
      'contact.intro': 'Vamos conversar sobre um projeto, uma vaga ou uma ideia.',
      'contact.email': 'Email',
      'contact.phone': 'Telefone',
      'contact.cv': 'Ver currículo',
      'contact.cv_alt': 'Resume in English',

      'footer.rights': 'Todos os direitos reservados.',

      'cookie.text': 'Este site usa armazenamento local do navegador (por exemplo, para lembrar sua preferência de tema claro/escuro). Ao continuar navegando, você concorda com isso.',
      'cookie.accept': 'Entendi',

      roles: ['Desenvolvedor Web', 'Inteligência Artificial', 'Web Design', 'Automação de Processos', 'Desenvolvedor de Sistemas']
    },

    en: {
      'meta.title': 'Luiz Henrique | Developer',
      'meta.description': 'Luiz Henrique’s portfolio: back-end and front-end development, automation, tools and databases.',

      'nav.home': 'Home',
      'nav.about': 'About',
      'nav.skills': 'Skills',
      'nav.history': 'Experience',
      'nav.projects': 'Projects',
      'nav.contact': 'Contact',

      'a11y.theme': 'Toggle light/dark theme',
      'a11y.theme_title': 'Toggle theme',
      'a11y.menu': 'Open menu',
      'a11y.scroll': 'Scroll to the About section',
      'a11y.lang': 'Choose language',
      'a11y.loading': 'Loading',

      'hero.greeting': 'Hi, I’m',
      'hero.desc': 'I work with back-end and front-end development, automation and databases, building practical everyday solutions — from websites to internal systems.',
      'hero.cta_contact': 'Get in touch',
      'hero.cta_projects': 'View projects',
      'hero.cta_cv': 'View resume',
      'cv.download': 'Download resume (PDF)',
      'cv.file': 'assets/curriculo/Luiz-Henrique-Pereira-Resume-EN.pdf',
      'cv.file_alt': 'assets/curriculo/Luiz-Henrique-Pereira-Curriculo-PT.pdf',

      'about.title': 'About',
      'about.p1': 'I’m a qualified IT technician with strong hands-on experience in databases, and I’m currently studying for a Bachelor’s degree in Computer Science at Uninter, focused on development.',
      'about.p2': 'I work professionally as a Software Development Analyst at IRKO Campinas. I like solving problems with code: automating repetitive tasks, building internal tools and developing systems from scratch.',

      'skills.title': 'Skills',
      'skills.intro': 'Knowledge organised by area, constantly being updated.',
      'skills.tools': 'Tools',
      'skills.database': 'Databases',
      'skills.ai': 'AI',
      'skills.responsive': 'Responsive design',
      'skills.logic': 'Programming logic',
      'skills.task_automation': 'Task automation',
      'skills.terminal': 'Terminal / command line',
      'skills.data_modeling': 'Data modelling',
      'skills.queries': 'Queries and optimisation',

      'history.title': 'Experience',
      'history.1.tag': 'Education',
      'history.1.title': 'IT Technician',
      'history.1.desc': 'Technical qualification with strong hands-on database work.',
      'history.2.tag': 'Courses · Hashtag, Cisco and SENAI',
      'history.2.title': 'Networking, AI, Git &amp; GitHub and Logic',
      'history.2.desc': 'Networking Basics (Cisco Networking Academy with UNINTER), Artificial Intelligence Impressionador (56 h), Git and GitHub, Algorithms and Programming Logic, plus ICT and communication courses.',
      'history.3.tag': 'Current · IRKO Campinas',
      'history.3.title': 'Software Development Analyst',
      'history.3.desc': 'Working on the development team, focused on internal systems and automation.',
      'history.4.tag': 'In progress · Uninter',
      'history.4.title': 'Bachelor’s in Computer Science',
      'history.4.desc': 'Degree in progress, with studies focused on software development.',

      'projects.title': 'Projects',
      'projects.intro': 'A few projects built at work and on my own.',
      'projects.tag.freelance': 'Freelance',
      'projects.tag.professional': 'Professional',
      'projects.tag.personal': 'Personal',
      'projects.link_online': 'View online',
      'projects.preview': 'Preview',
      'projects.preview_close': 'Close',
      'projects.preview_open': 'Open the project',
      'projects.preview_prev': 'Previous project',
      'projects.preview_next': 'Next project',
      'projects.preview_shot': 'Screenshot of',
      'projects.preview_hint': '← → switch projects · Esc closes',
      'projects.gourmet.short': 'Custom online store for a gourmet popcorn brand: catalog, bucket builder, cart with WhatsApp checkout and an admin panel so the client can manage the menu on their own.',
      'projects.receivables.short': 'Builds the receivables batch: imports the revenue sheet, matches each client to the registry, checks tax ID and ledger account and generates the ERP import file.',
      'projects.fiscal.short': 'Sales-by-channel tax statement that started in VBA: returns, discounts and taxes laid out like a ledger, plus checks that flag what to review before closing the month.',
      'projects.cedro.short': 'Furniture store browsed through the showroom floor plan, with pieces drawn to scale and a calculator that tells whether it fits your room. <em>(admin: <code>admin</code> / <code>cedrodecor2026</code>)</em>',
      'projects.clinic.short': 'Psychologist scheduling built on the 50-minute clinical hour: close each session with attendance, charged or waived no-show, private note and payment, plus a discreet mode for when someone can see the screen.',
      'projects.wedding.short': 'A shared notebook to plan a wedding by the months left: tasks, installments and how much to save each month, guests counted per person and the day\'s schedule. <em>(access code: 0809)</em>',
      'projects.tattoo.short': 'Editorial, monochrome site for a tattoo studio, with a filterable gallery, lightbox and WhatsApp booking.',
      'projects.fuel.short': 'Ethanol or petrol, built like a gas station forecourt: works out the right threshold for your car’s mileage and simulates filling up.',
      'projects.prato.short': 'A calorie, nutrient and water tracker that looks like a health app: guided questionnaire, foods filtered by your health profile, meals your way and nutrition labels read from a photo. Installs on your phone.',
      'projects.abnt.short': 'Formats college papers to ABNT or APA 7: reads Word, PDF or text, builds the cover, contents and references and flags what breaks the rules.',
      'projects.steno.short': 'Transcribes a YouTube live stream and writes down the keywords when the speaker announces them, with nothing to install.',

      'projects.gourmet.icon': 'Gourmet popcorn',
      'projects.gourmet.desc': 'Online store for a gourmet popcorn brand, built to order. Flavour catalogue by category (Traditional and VIP), a custom bucket builder (size, quantity and up to 2 flavours), a full shopping cart with quantity control and subtotal, and checkout straight through WhatsApp. It includes an admin panel with authentication where the client herself adds, edits and removes catalogue flavours (with photo upload) without needing me for every change. The upload goes through a serverless function that validates the session before writing to Supabase Storage, without exposing any sensitive key in the browser.',

      'projects.receivables.icon': 'Accounts receivable',
      'projects.receivables.title': 'Accounts Receivable Issuing',
      'projects.receivables.desc': 'Internal tool for issuing accounts receivable. Items are entered by hand (with monthly installments) or from the revenue sheet sent from abroad, where each client name is matched to a recipient through its keys; anything that does not match you link once and it learns. Each item shows up as a stub with the due day and flags invalid CNPJ, missing ledger account, due date before issue date, weekends and possible duplicates. A calendar strip shows where the cash concentrates. Issuing downloads the file in the ERP import layout and stores the stamped batch in the archive, with a snapshot of the registry on that day. Rewritten from scratch for the portfolio. <em>(demo with fictitious data)</em>',

      'projects.fiscal.icon': 'Tax analysis',
      'projects.fiscal.desc': 'It started as a VBA macro and grew into a system. It reads the outgoing and incoming tax books (returns come from the latter) and service invoices, assigns each item to a sales channel through company, series and CFOP rules, and builds the statement: sales, returns, discounts, ICMS, PIS, COFINS, DIFAL and net sales. The checks flag CFOPs outside the list, effective ICMS rates out of range and returns with no sale in the period; each entry explains which rule classified it; and the importer finds the header row by itself and shows the column mapping before saving. This version was rewritten from scratch for the portfolio. <em>(demo with fictitious data)</em>',

      'projects.cedro.icon': 'Furniture store in plan',
      'projects.cedro.desc': 'A furniture store you browse through the <strong>showroom floor plan</strong>: instead of a menu, you click a room and a marker walks down the corridor to it. The furniture is drawn to scale from the recorded measurements — one source feeds the plan, the spec sheet with dimension lines, and a “will it fit?” calculator that compares a piece against the visitor’s own room and says how much clearance is left. It also has a colour filter, low-stock warnings and a panel to manage pieces, testimonials and visits. <em>(admin login: user <code>admin</code>, password <code>cedrodecor2026</code>)</em>',

      'projects.clinic.icon': 'Clinic management',
      'projects.clinic.title': 'Clinic Manager',
      'projects.clinic.desc': 'Built around a psychologist\'s routine, with no sign-up screen: it opens straight on the week. Each patient has a color and a fixed slot (weekly or every two weeks), and the schedule shows extra sessions, no-shows and cancellations. Clicking a session opens a panel to close it: done, no-show charged under the 24-hour policy or waived, a private note and payment on the spot. The patient record combines a timeline of session notes with a running account balance; the monthly finance view separates what belongs to the month from what is overdue and prints receipts with the amount in words. Discreet mode swaps names for initials and blurs the notes. Rewritten from scratch for the portfolio. <em>(demo with fictitious patients and notes)</em>',

      'projects.wedding.icon': 'Wedding planner',
      'projects.wedding.desc': 'Organized the way weddings are really planned: by the months left. The main screen is the path from today to the day, with each month\'s tasks (and who owns them), supplier installments due and anything left behind. Guests are split by side and counted per person, with plus-ones, children, RSVP and the venue limit; a whole list of names can be pasted at once. The money view compares planned, contracted and paid per category and works out how much to save each month. Suppliers move from researching to hired, and the day view holds venues, an hour-by-hour schedule and emergency contacts. Rewritten from scratch for the portfolio. <em>(fictitious couple, access code: 0809)</em>',
      'projects.invite.icon': 'Invitation',
      'projects.invite.title': 'Graduation invitation',
      'projects.invite.short': 'A graduation invitation as a website: a question with a runaway No button, confetti and the invitation with a countdown and map.',
      'projects.invite.desc': 'Made for my fiancée\'s graduation. It opens asking whether you already have plans that day; the No button runs away on every try, with little messages, while Yes keeps growing. Yes bursts into confetti and shows the Agora tem! art with a stamp effect, then the invitation rebuilds the original artwork as taped paper notes: photo, date, venue with a map link, a live countdown and a button that saves the event to your calendar (.ics). CSS and canvas animations, no libraries, built to be opened on a phone from WhatsApp.',

      'projects.tattoo.icon': 'Tattoo studio',
      'projects.tattoo.desc': 'Site for a tattoo studio, in an editorial monochrome design: serif typography and a hierarchy built from space and 1px rules rather than cards. Mosaic gallery with a style filter and a lightbox you can navigate by keyboard, a step-by-step of how a booking works, an accordion FAQ, and a form that composes the message and opens WhatsApp. <em>(fictitious studio; the images are placeholders marked “sua foto”, ready for the real portfolio)</em>',
      'projects.abnt.icon': 'Papers in ABNT format',
      'projects.steno.icon': 'Notes the live stream keyword',
      'projects.steno.desc': 'Follows a YouTube live stream, transcribes everything that is said and writes down the keywords when the speaker announces them, whether one or eight. Nothing to install: paste the link, the stream opens with captions on and, once the tab is shared, Taquígrafo reads the captions and slides from the image itself (Tesseract, in a Web Worker so the video does not stutter), listens to the speech (Whisper, running on the computer itself) and, with a free YouTube API key, reads the chat. The transcript prints on a stenotype “tape”: anything related to the keyword gets highlighter and a margin note, every time the word is said it gets circled and, when it comes out, the tape gets a numbered stamp. It understands “the keyword is…”, “the second word is…”, “keyword number 3:…” and lists, even spelled out, and merges repeated readings to fix a misread letter. It beeps, notifies, copies all of them at once and downloads the transcript as .txt; nothing leaves the browser. There is also a Tampermonkey script. <em>(there is a demo stream to try it)</em>',
      'projects.abnt.desc': 'Turns a college paper into the Brazilian ABNT format or APA 7, designed with psychology students in mind. It reads Word (.docx), PDF or pasted text and recognises headings, block quotes, list items, references, tables, images and footnotes on its own (every mark can be fixed, colour-coded like highlighter pen). It reuses the cover page already in the file and lays out cover, title page, approval page, dedication, epigraph, abstract, lists of figures and abbreviations, a table of contents with the right page numbers and the body, on A4 sheets typeset on screen: a long table continues on the next sheet with its header repeated, and each footnote lands at the foot of the page that calls it. Before download it checks that every citation has a reference, that direct quotes have a page number, that the abstract and keywords fit the standard and that references are well formed, with a fix button; it warns when a patient’s name, or an age-plus-job combination that identifies someone, slipped in. It converts references from ABNT to APA, builds new ones and never lets a cover go out with an empty field. It downloads an editable .docx written straight in XML (with real footnotes, tables and images) or saves to PDF. Everything runs in the browser: the text never leaves the computer. <em>(there’s a ready-made example to try)</em>',
      'projects.fuel.icon': 'Ethanol or petrol',
      'projects.prato.icon': 'Calorie counter',
      'projects.fuel.desc': 'An ethanol-or-petrol calculator built like a Brazilian filling station forecourt: the price board (with the tiny ⁹ at the end), a windscreen sticker holding the car’s fuel economy, and a mechanical pump whose drums roll like an odometer. Instead of the generic 70% rule, it works out the real break-even point for each car’s consumption, shows the cost per km of both fuels and how much a full tank saves. The R$ 50, 100 and 150 keys simulate the fill-up: the fuel gauge rises, the readout says how many km it buys and, if it won’t fit, the nozzle clicks off with the tank full. <em>(defaults to a 2005 VW Gol G3 1.6 with its spec-sheet consumption; you can pick another car or type in your own)</em>',
      'projects.prato.desc': 'A calorie, nutrient and water tracker with a clinical look that can be installed on a phone as an app (a PWA with a home-screen icon that works offline). On first open the user creates a local account (the Google button is illustrative only) and answers a guided questionnaire, one question per screen with smooth transitions: sex, age, height, weight, activity, goal, the plan’s pace (light, moderate or intense, for faster gains), target weight, health conditions, allergies and diet. The app works out the basal metabolic rate with the Mifflin-St Jeor equation and a daily target for calories, protein, carbs, fat, fibre and water, with a safety floor, no deficit during pregnancy and warnings when the pace gets demanding. The health profile becomes a filter: allergies, coeliac disease, lactose intolerance and a vegetarian or vegan diet hide what the person cannot eat; diabetes and hypertension flag foods high in sugar or sodium, using Brazil’s ANVISA front-of-pack thresholds. Search covers 100+ reference foods (Brazilian TACO table and USDA) with thumbnails, 100+ McDonald’s and Burger King items from the chains’ official nutrition tables, and Open Food Facts products with photos and allergens. The day starts empty and the person creates as many meals as they like, each with several foods, counted in units (2 eggs) or grams; foods that cannot be found are added from a photo of the nutrition label (OCR with Tesseract in the browser, which also reads the “ALLERGENS: CONTAINS…” notice), by barcode, by typing or by duplicating a similar one. There is also water tracking with a goal, a seven-day chart and a backup file; everything stays on the device, with no server. <em>(there’s a ready-made demo to try)</em>',

      'projects.automations_title': 'Automations · Power Automate',
      'projects.automations_intro': 'Automation flows built with Power Automate, integrated with other everyday tools. No interface of their own, but development all the same.',

      'projects.planner.icon': 'Task approval',
      'projects.planner.title': 'Task Approval in Planner',
      'projects.planner.desc': 'Flow integrated with Microsoft Planner: tasks are created automatically from Microsoft Forms responses, used as variables to set the type, priority and the task’s remaining fields. When a task is finished, Power Automate triggers an approval request (Approvals) and, depending on the validation result, it moves itself to the completed bucket or goes back for execution if rejected.',

      'projects.omie.icon': 'Stock',
      'projects.omie.title': 'Stock Automation in Omie',
      'projects.omie.desc': 'Flow that automatically reproduces the manual clicks and stock movement adjustments in the Omie ERP, removing the need for an operator to make those entries one by one.',

      'contact.title': 'Contact',
      'contact.intro': 'Let’s talk about a project, a job or an idea.',
      'contact.email': 'Email',
      'contact.phone': 'Phone',
      'contact.cv': 'View resume',
      'contact.cv_alt': 'Currículo em português',

      'footer.rights': 'All rights reserved.',

      'cookie.text': 'This site uses your browser’s local storage (for example, to remember your light/dark theme preference). By continuing to browse, you agree to this.',
      'cookie.accept': 'Got it',

      roles: ['Web Developer', 'Artificial Intelligence', 'Web Design', 'Process Automation', 'Systems Developer']
    },

    es: {
      'meta.title': 'Luiz Henrique | Desarrollador',
      'meta.description': 'Portafolio de Luiz Henrique: desarrollo back-end, front-end, automatizaciones, herramientas y bases de datos.',

      'nav.home': 'Inicio',
      'nav.about': 'Sobre mí',
      'nav.skills': 'Habilidades',
      'nav.history': 'Trayectoria',
      'nav.projects': 'Proyectos',
      'nav.contact': 'Contacto',

      'a11y.theme': 'Alternar tema claro/oscuro',
      'a11y.theme_title': 'Alternar tema',
      'a11y.menu': 'Abrir menú',
      'a11y.scroll': 'Desplazarse a la sección Sobre mí',
      'a11y.lang': 'Elegir idioma',
      'a11y.loading': 'Cargando',

      'hero.greeting': 'Hola, soy',
      'hero.desc': 'Trabajo con desarrollo back-end, front-end, automatizaciones y bases de datos, creando soluciones prácticas para el día a día, desde sitios web hasta sistemas internos.',
      'hero.cta_contact': 'Ponerse en contacto',
      'hero.cta_projects': 'Ver proyectos',
      'hero.cta_cv': 'Ver currículum',
      'cv.download': 'Descargar currículum (PDF, en inglés)',
      'cv.file': 'assets/curriculo/Luiz-Henrique-Pereira-Resume-EN.pdf',
      'cv.file_alt': 'assets/curriculo/Luiz-Henrique-Pereira-Curriculo-PT.pdf',

      'about.title': 'Sobre mí',
      'about.p1': 'Soy técnico en informática, titulado y con fuerte experiencia práctica en bases de datos, y actualmente curso la Licenciatura en Ciencia de la Computación en Uninter, con enfoque en desarrollo.',
      'about.p2': 'Trabajo profesionalmente como Analista de Desarrollo en IRKO Campinas. Me gusta resolver problemas con código: automatizar tareas repetitivas, construir herramientas internas y desarrollar sistemas desde cero.',

      'skills.title': 'Habilidades',
      'skills.intro': 'Conocimientos organizados por área, en constante actualización.',
      'skills.tools': 'Herramientas',
      'skills.database': 'Bases de Datos',
      'skills.ai': 'IA',
      'skills.responsive': 'Diseño responsivo',
      'skills.logic': 'Lógica de programación',
      'skills.task_automation': 'Automatización de tareas',
      'skills.terminal': 'Terminal / línea de comandos',
      'skills.data_modeling': 'Modelado de datos',
      'skills.queries': 'Consultas y optimización',

      'history.title': 'Trayectoria',
      'history.1.tag': 'Formación',
      'history.1.title': 'Técnico en Informática',
      'history.1.desc': 'Formación técnica con fuerte trabajo práctico en bases de datos.',
      'history.2.tag': 'Cursos · Hashtag, Cisco y SENAI',
      'history.2.title': 'Redes, IA, Git &amp; GitHub y Lógica',
      'history.2.desc': 'Conceptos Básicos de Redes (Cisco Networking Academy con UNINTER), Inteligencia Artificial Impressionador (56 h), Git y GitHub, Algoritmos y Lógica de Programación, además de cursos de TIC y comunicación.',
      'history.3.tag': 'Actual · IRKO Campinas',
      'history.3.title': 'Analista de Desarrollo',
      'history.3.desc': 'Trabajo en el equipo de desarrollo, con enfoque en sistemas internos y automatizaciones.',
      'history.4.tag': 'En curso · Uninter',
      'history.4.title': 'Licenciatura en Ciencia de la Computación',
      'history.4.desc': 'Grado en curso, con estudios enfocados en desarrollo de software.',

      'projects.title': 'Proyectos',
      'projects.intro': 'Algunos proyectos desarrollados en el trabajo y por cuenta propia.',
      'projects.tag.freelance': 'Freelance',
      'projects.tag.professional': 'Profesional',
      'projects.tag.personal': 'Personal',
      'projects.link_online': 'Ver en línea',
      'projects.preview': 'Vista previa',
      'projects.preview_close': 'Cerrar',
      'projects.preview_open': 'Abrir el proyecto',
      'projects.preview_prev': 'Proyecto anterior',
      'projects.preview_next': 'Siguiente proyecto',
      'projects.preview_shot': 'Pantalla de',
      'projects.preview_hint': '← → cambian de proyecto · Esc cierra',
      'projects.gourmet.short': 'Tienda online de palomitas gourmet hecha por encargo: catálogo, armador de baldes, carrito con pedido por WhatsApp y un panel para que la propia clienta gestione el menú.',
      'projects.receivables.short': 'Arma la remesa de títulos por cobrar: importa la planilla de ingresos, vincula cada cliente con el registro, verifica CNPJ y cuenta contable y genera el archivo del ERP.',
      'projects.fiscal.short': 'Liquidación de ventas por canal que nació en VBA: devoluciones, descuentos e impuestos en formato de estado contable, con verificaciones de lo que hay que revisar antes del cierre.',
      'projects.cedro.short': 'Tienda de muebles que se recorre por el plano del showroom, con piezas dibujadas a escala y una calculadora que dice si el mueble cabe en tu cuarto. <em>(admin: <code>admin</code> / <code>cedrodecor2026</code>)</em>',
      'projects.clinic.short': 'Agenda de psicóloga en la hora clínica de 50 minutos: cierra la sesión con asistencia, falta cobrada o perdonada, nota privada y pago, y tiene modo discreto para cuando alguien mira la pantalla.',
      'projects.wedding.short': 'Un cuaderno en pareja para planear la boda por los meses que faltan: tareas, cuotas y cuánto ahorrar cada mes, invitados contados por persona y el cronograma del día. <em>(código de acceso: 0809)</em>',
      'projects.tattoo.short': 'Sitio editorial y monocromático para un estudio de tatuajes, con galería filtrable, lightbox y reservas por WhatsApp.',
      'projects.fuel.short': 'Etanol o gasolina, armado como una estación de servicio: calcula el límite justo para el consumo de tu auto y simula la carga.',
      'projects.prato.short': 'App de calorías, nutrientes y agua con cara de app de salud: cuestionario guiado, alimentos filtrados por tu perfil de salud, comidas a tu manera y lectura de la tabla nutricional por foto. Se instala en el celular.',
      'projects.abnt.short': 'Formatea trabajos universitarios en ABNT o APA 7: lee Word, PDF o texto, arma portada, índice y referencias y señala lo que no cumple la norma.',
      'projects.steno.short': 'Transcribe un directo de YouTube y anota las palabras clave cuando el expositor las anuncia, sin instalar nada.',

      'projects.gourmet.icon': 'Palomitas gourmet',
      'projects.gourmet.desc': 'Tienda online para una marca de palomitas gourmet, desarrollada por encargo. Catálogo de sabores por categoría (Tradicionales y VIP), un armador de baldes personalizados (tamaño, cantidad y hasta 2 sabores a elegir), carrito de compras completo con control de cantidad y subtotal, y finalización del pedido directamente por WhatsApp. Incluye un panel administrativo con autenticación, donde la propia clienta registra, edita y elimina sabores (con carga de foto) del catálogo sin depender de mí para cada cambio. La carga pasa por una función serverless que valida la sesión antes de guardar en Supabase Storage, sin exponer ninguna clave sensible en el navegador.',

      'projects.receivables.icon': 'Cuentas por cobrar',
      'projects.receivables.title': 'Emisión de Cuentas por Cobrar',
      'projects.receivables.desc': 'Herramienta interna de emisión de cuentas por cobrar. Los títulos se cargan a mano (con cuotas mensuales) o desde la planilla de ingresos que llega del exterior, donde cada nombre de cliente se vincula a un destinatario por sus claves; lo que no coincide se vincula una vez y la herramienta aprende. Cada título aparece como un talón con el día de vencimiento y señala CNPJ inválido, falta de cuenta contable, vencimiento anterior a la emisión, fin de semana y posible duplicidad. Una franja de calendario muestra dónde se concentra el dinero. Al emitir, descarga el archivo en el formato de importación del ERP y guarda la remesa sellada en el archivo, con la foto del registro de ese día. Reescrita desde cero para el portafolio. <em>(demo con datos ficticios)</em>',

      'projects.fiscal.icon': 'Análisis fiscal',
      'projects.fiscal.desc': 'Empezó como una macro en VBA y se convirtió en sistema. Lee los libros fiscales de salida y de entrada (de donde salen las devoluciones) y las facturas de servicios, clasifica cada ítem en un canal según reglas de empresa, serie y CFOP y arma el estado: ventas, devoluciones, descuentos, ICMS, PIS, COFINS, DIFAL y ventas netas. Las verificaciones señalan CFOP fuera de la lista, ICMS efectivo fuera del rango y devoluciones sin venta en el período; cada asiento explica qué regla lo clasificó; y la importación encuentra sola la fila de encabezado y muestra el mapeo de columnas antes de guardar. Esta versión fue reescrita desde cero para el portafolio. <em>(demo con datos ficticios)</em>',

      'projects.cedro.icon': 'Tienda de muebles en plano',
      'projects.cedro.desc': 'Tienda de muebles que se recorre por el <strong>plano del showroom</strong>: en lugar de un menú, haces clic en un ambiente y un marcador camina por el pasillo hasta él. Los muebles se dibujan a escala a partir de las medidas cargadas — la misma fuente alimenta el plano, la ficha técnica con cotas y la calculadora «¿va a caber?», que compara la pieza con la habitación de la persona y dice cuánta holgura queda. Incluye filtro por color, aviso de stock bajo y panel para gestionar piezas, testimonios y visitas. <em>(acceso admin: usuario <code>admin</code>, contraseña <code>cedrodecor2026</code>)</em>',

      'projects.clinic.icon': 'Gestión clínica',
      'projects.clinic.title': 'Consultorio',
      'projects.clinic.desc': 'Hecho a partir de la rutina de una psicóloga, sin pantalla de registro: abre directo en la semana. Cada paciente tiene color y horario fijo (semanal o quincenal) y la agenda marca sesiones extra, faltas y cancelaciones. Al hacer clic en una sesión, un panel la cierra: realizada, falta cobrada según la política de 24 horas o perdonada, nota privada y pago en el momento. La ficha del paciente reúne la historia clínica en línea de tiempo y la cuenta corriente con saldo; el financiero del mes separa lo del mes de lo atrasado e imprime recibos con el valor en letras. El modo discreto cambia nombres por iniciales y difumina las notas. Reescrito desde cero para el portafolio. <em>(demo con pacientes y notas ficticios)</em>',

      'projects.wedding.icon': 'Organizador de boda',
      'projects.wedding.desc': 'Organizado como se planea una boda de verdad: por los meses que faltan. La pantalla principal es el camino de hoy hasta el día, con las tareas de cada mes (y de quién es cada una), las cuotas de proveedores que vencen y lo que quedó atrás. Los invitados se separan por lado y se cuentan por persona, con acompañantes, niños, confirmación y el límite del salón; se puede pegar una lista de nombres de una vez. El dinero compara lo previsto, contratado y pagado por categoría y calcula cuánto ahorrar por mes. Los proveedores avanzan de investigando a contratado, y el día reúne lugares, cronograma hora por hora y contactos de emergencia. Reescrito desde cero para el portafolio. <em>(pareja ficticia, código de acceso: 0809)</em>',
      'projects.invite.icon': 'Invitación',
      'projects.invite.title': 'Invitación de graduación',
      'projects.invite.short': 'Invitación de graduación en forma de sitio: una pregunta con un botón de no que huye, confeti y la invitación con cuenta regresiva y mapa.',
      'projects.invite.desc': 'Hecha para la graduación de mi novia. Abre preguntando si ya tienes compromiso ese día; el botón de no huye en cada intento, con mensajes, mientras el sí crece. El sí estalla en confeti y muestra el Agora tem! con efecto de sello, y después la invitación arma el arte original en notas de papel con cinta: foto, fecha, lugar con enlace al mapa, cuenta regresiva y un botón que guarda el evento en el calendario (.ics). Animaciones en CSS y canvas, sin bibliotecas, pensada para abrirse en el celular desde WhatsApp.',

      'projects.tattoo.icon': 'Estudio de tatuajes',
      'projects.tattoo.desc': 'Sitio para un estudio de tatuajes, con un diseño editorial y monocromático: tipografía con serifa y una jerarquía hecha de espacio y filetes de 1px en lugar de tarjetas. Galería en mosaico con filtro por estilo y lightbox navegable con el teclado, paso a paso de la atención, FAQ en acordeón y un formulario que arma el mensaje y abre WhatsApp. <em>(estudio ficticio; las imágenes son espacios reservados marcados «sua foto», listos para el acervo real)</em>',
      'projects.abnt.icon': 'Trabajos con normas ABNT',
      'projects.steno.icon': 'Anota la palabra clave del directo',
      'projects.steno.desc': 'Sigue un directo de YouTube, transcribe todo lo que se dice y anota las palabras clave cuando el expositor las anuncia, sea una u ocho. Sin instalar nada: se pega el enlace, el directo se abre con los subtítulos activados y, al compartir la pestaña, Taquígrafo lee los subtítulos y las diapositivas en la propia imagen (Tesseract, en un Web Worker para que el video no se trabe), escucha el habla (Whisper, en la propia computadora) y, con la clave gratuita de la API de YouTube, lee el chat. La transcripción sale en una “cinta” de estenotipia: lo relacionado con la palabra clave recibe marcador y una nota al margen, cada vez que se dice la palabra queda rodeada y, cuando sale, la cinta recibe un sello numerado. Entiende “la palabra clave es…”, “la segunda palabra es…”, “palabra clave número 3:…” y listas, incluso deletreadas, y junta lecturas repetidas para corregir una letra mal leída. Pita, notifica, copia todas de una vez y descarga la transcripción en .txt; nada sale del navegador. También hay un script para Tampermonkey. <em>(hay un directo de demostración para probar)</em>',
      'projects.abnt.desc': 'Convierte un trabajo universitario al formato brasileño ABNT o a APA 7, pensado para estudiantes de psicología. Lee Word (.docx), PDF o texto pegado y reconoce solo títulos, citas largas, incisos, referencias, tablas, imágenes y notas al pie (cada marca se puede corregir, con colores de resaltador). Aprovecha la portada que ya venga en el archivo y arma portada, hoja de título, hoja de aprobación, dedicatoria, epígrafe, resumen, listas de ilustraciones y de siglas, índice con las páginas correctas y el cuerpo, en hojas A4 diagramadas en pantalla: una tabla larga sigue en la hoja siguiente con el encabezado repetido y cada nota cae al pie de la página donde se llama. Antes de descargar verifica que toda cita tenga referencia, que la cita directa tenga página, que el resumen y las palabras clave estén en la medida y que las referencias tengan el formato correcto, con botón para corregir; avisa si se coló el nombre de un paciente o una combinación de edad y profesión que identifica a alguien. Convierte referencias de ABNT a APA, arma referencias nuevas y no deja salir una portada con campos vacíos. Descarga un .docx editable, escrito directo en XML (con notas, tablas e imágenes de verdad), o guarda en PDF. Todo corre en el navegador: el texto nunca sale de la computadora. <em>(hay un ejemplo listo para probar)</em>',
      'projects.fuel.icon': 'Etanol o gasolina',
      'projects.prato.icon': 'Contador de calorías',
      'projects.fuel.desc': 'Calculadora de etanol o gasolina armada como el patio de una estación de servicio brasileña: el cartel de precios (con el ⁹ pequeñito), una etiqueta de parabrisas con el consumo del auto y un surtidor mecánico con tambores que giran como un odómetro. En lugar de la regla genérica del 70%, calcula el límite correcto para el consumo de cada auto, muestra el costo por km de los dos combustibles y cuánto se ahorra en un tanque lleno. Las teclas de R$ 50, 100 y 150 simulan la carga: el indicador de combustible sube, la lectura dice cuántos km rinde y, si no entra, la pistola corta con el tanque lleno. <em>(por defecto es un VW Gol G3 1.6 2005 con el consumo de la ficha técnica; se puede cambiar de auto o cargar el tuyo)</em>',
      'projects.prato.desc': 'App de calorías, nutrientes y agua con aspecto clínico que se puede instalar en el celular como una app (PWA, con ícono en la pantalla de inicio y funcionando sin internet). Al abrirlo, la persona crea una cuenta local (el botón de Google es solo ilustrativo) y responde un cuestionario guiado, una pregunta por pantalla con transiciones suaves: sexo, edad, altura, peso, actividad, objetivo, el ritmo del plan (leve, moderado o intenso, para avances más rápidos), peso deseado, condiciones de salud, alergias y tipo de alimentación. La app calcula el metabolismo basal con la ecuación de Mifflin-St Jeor y la meta diaria de calorías, proteína, carbohidrato, grasa, fibra y agua, con piso de seguridad, sin déficit en el embarazo y avisos cuando el ritmo se vuelve exigente. El perfil de salud se vuelve filtro: alergias, celiaquía, intolerancia a la lactosa y dieta vegetariana o vegana ocultan lo que la persona no puede comer; diabetes e hipertensión señalan lo que tiene mucho azúcar o sodio, con los límites del rotulado frontal de la ANVISA de Brasil. La búsqueda reúne más de 100 alimentos de referencia (TACO brasileña y USDA) con miniaturas, más de 100 ítems de McDonald’s y Burger King con las tablas nutricionales oficiales de las cadenas y productos de Open Food Facts con foto y alérgenos. El día empieza vacío y la persona crea cuantas comidas quiera, cada una con varios alimentos, contados en unidades (2 huevos) o en gramos; lo que no se encuentra se registra con la foto de la tabla nutricional (OCR con Tesseract en el navegador, que también lee el aviso “ALÉRGICOS: CONTIENE…”), por código de barras, escribiendo o duplicando uno parecido. También tiene control de agua con meta, gráfico de los últimos siete días y copia de seguridad en archivo; todo queda en el dispositivo, sin servidor. <em>(hay una demostración lista para probar)</em>',

      'projects.automations_title': 'Automatizaciones · Power Automate',
      'projects.automations_intro': 'Flujos de automatización desarrollados con Power Automate, integrados con otras herramientas del día a día. Sin interfaz propia, pero desarrollo igualmente.',

      'projects.planner.icon': 'Aprobación de tareas',
      'projects.planner.title': 'Aprobación de Tareas en Planner',
      'projects.planner.desc': 'Flujo integrado con Microsoft Planner: las tareas se crean automáticamente a partir de las respuestas de un Microsoft Forms, usadas como variables para definir tipo, prioridad y los demás campos de la tarea. Al finalizar una tarea, Power Automate dispara una solicitud de aprobación (Approvals) y, según el resultado de la validación, se mueve sola al bucket de finalizadas o vuelve para ejecución en caso de rechazo.',

      'projects.omie.icon': 'Stock',
      'projects.omie.title': 'Automatización de Stock en Omie',
      'projects.omie.desc': 'Flujo que reproduce automáticamente los clics y ajustes manuales de movimiento de stock en el ERP Omie, eliminando la necesidad de que un operador realice esos asientos uno a uno.',

      'contact.title': 'Contacto',
      'contact.intro': 'Hablemos de un proyecto, una vacante o una idea.',
      'contact.email': 'Correo',
      'contact.phone': 'Teléfono',
      'contact.cv': 'Ver currículum (en inglés)',
      'contact.cv_alt': 'Versión en portugués',

      'footer.rights': 'Todos los derechos reservados.',

      'cookie.text': 'Este sitio usa el almacenamiento local del navegador (por ejemplo, para recordar tu preferencia de tema claro/oscuro). Al continuar navegando, aceptas esto.',
      'cookie.accept': 'Entendido',

      roles: ['Desarrollador Web', 'Inteligencia Artificial', 'Diseño Web', 'Automatización de Procesos', 'Desarrollador de Sistemas']
    }
  };

  function detect() {
    var saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { saved = null; }
    if (saved && DICT[saved]) return saved;
    var nav = (navigator.language || navigator.userLanguage || FALLBACK).slice(0, 2).toLowerCase();
    return DICT[nav] ? nav : FALLBACK;
  }

  var current = detect();

  function dict() { return DICT[current] || DICT[FALLBACK]; }

  // Guarda o conteúdo original (português, escrito direto no HTML) antes da
  // primeira tradução. Sem isso, uma chave que exista só em en/es deixaria o
  // elemento preso no último idioma aplicado ao voltar pro português.
  var ORIGINAL = new WeakMap();

  function original(el, key, read) {
    var store = ORIGINAL.get(el);
    if (!store) { store = {}; ORIGINAL.set(el, store); }
    if (!(key in store)) store[key] = read();
    return store[key];
  }

  function setAttrFromData(attrData, attrName) {
    document.querySelectorAll('[' + attrData + ']').forEach(function (el) {
      var fallback = original(el, attrName, function () { return el.getAttribute(attrName); });
      var value = dict()[el.getAttribute(attrData)];
      if (value == null) value = fallback;
      if (value != null) el.setAttribute(attrName, value);
    });
  }

  function apply(lang) {
    if (lang && DICT[lang]) current = lang;
    var d = dict();
    var meta = LANGS.filter(function (l) { return l.code === current; })[0] || LANGS[0];

    document.documentElement.setAttribute('lang', meta.htmlLang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var fallback = original(el, 'html', function () { return el.innerHTML; });
      var value = d[el.getAttribute('data-i18n')];
      if (value == null) value = fallback;
      // innerHTML porque algumas traduções carregam <em>/<code>; o conteúdo é
      // todo estático deste arquivo, não vem de entrada de usuário.
      if (value != null) el.innerHTML = value;
    });
    setAttrFromData('data-i18n-title', 'title');
    setAttrFromData('data-i18n-aria', 'aria-label');
    setAttrFromData('data-i18n-href', 'href'); // currículo no idioma do site

    if (d['meta.title']) document.title = d['meta.title'];
    var desc = document.querySelector('meta[name="description"]');
    if (desc && d['meta.description']) desc.setAttribute('content', d['meta.description']);

    document.querySelectorAll('.lang-option').forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === current;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    var flag = document.getElementById('langFlag');
    var code = document.getElementById('langCode');
    if (flag) flag.innerHTML = FLAGS[current];
    if (code) code.textContent = current.toUpperCase();

    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: current } }));
  }

  function set(lang) {
    if (!DICT[lang] || lang === current) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* modo privado */ }
    // A troca em si é instantânea; o loader entra só para a mudança não
    // acontecer num piscar de olhos, com o texto trocando debaixo do cursor.
    document.dispatchEvent(new CustomEvent('i18n:changing'));
    setTimeout(function () { apply(lang); }, 280);
  }

  function buildSwitcher() {
    var mount = document.getElementById('langSwitcher');
    if (!mount) return;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'lang-current';
    toggle.id = 'langToggle';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('data-i18n-aria', 'a11y.lang');
    toggle.innerHTML =
      '<span class="flag" id="langFlag"></span>' +
      '<span class="lang-code" id="langCode"></span>' +
      '<svg class="lang-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    var menu = document.createElement('ul');
    menu.className = 'lang-menu';
    menu.id = 'langMenu';
    menu.setAttribute('role', 'listbox');
    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-option';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-lang', l.code);
      btn.setAttribute('lang', l.htmlLang);
      btn.innerHTML = '<span class="flag">' + FLAGS[l.code] + '</span><span>' + l.label + '</span>';
      btn.addEventListener('click', function () {
        set(l.code);
        close();
      });
      li.appendChild(btn);
      menu.appendChild(li);
    });

    mount.appendChild(toggle);
    mount.appendChild(menu);

    function close() {
      mount.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = mount.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!mount.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  buildSwitcher();
  apply(current);

  window.I18N = {
    get lang() { return current; },
    set: set,
    t: function (key) { return dict()[key]; },
    roles: function () { return dict().roles || DICT[FALLBACK].roles; }
  };
})();
