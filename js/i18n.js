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

      'hero.greeting': 'Olá, eu sou',
      'hero.desc': 'Trabalho com desenvolvimento back-end, front-end, automações e banco de dados, criando soluções práticas para o dia a dia, de sites a sistemas internos.',
      'hero.cta_contact': 'Entrar em contato',
      'hero.cta_projects': 'Ver projetos',

      'about.title': 'Sobre',
      'about.p1': 'Sou técnico em informática, formado com forte atuação prática em banco de dados, e hoje curso Bacharelado em Ciência da Computação pela Uninter, com foco em desenvolvimento.',
      'about.p2': 'Atuo profissionalmente como Assistente de Desenvolvimento na IRKO Campinas. Gosto de resolver problemas com código: automatizar tarefas repetitivas, construir ferramentas internas e desenvolver sistemas do zero.',

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
      'history.2.tag': 'Cursos · Hashtag Programação',
      'history.2.title': 'Git &amp; GitHub / Lógica de Programação',
      'history.2.desc': 'Cursos online focados em controle de versão colaborativo e fundamentos de lógica de programação.',
      'history.3.tag': 'Atual · IRKO Campinas',
      'history.3.title': 'Assistente de Desenvolvimento',
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

      'projects.gourmet.icon': 'Pipoca gourmet',
      'projects.gourmet.desc': 'Loja virtual para uma marca de pipoca gourmet, desenvolvida sob encomenda. Catálogo de sabores por categoria (Tradicionais e VIP), um montador de baldes personalizados (tamanho, quantidade e até 2 sabores à escolha), carrinho de compras completo com controle de quantidade e subtotal, e finalização de pedido direto pelo WhatsApp. Inclui um painel administrativo com autenticação, onde a própria cliente cadastra, edita e remove sabores (com upload de foto) do catálogo sem precisar de mim para cada alteração. O upload passa por uma função serverless que valida a sessão antes de gravar no Supabase Storage, sem expor nenhuma chave sensível no navegador.',

      'projects.receivables.icon': 'Contas a receber',
      'projects.receivables.title': 'Emissão de Contas a Receber',
      'projects.receivables.desc': 'Sistema interno de gestão de recebíveis: emissão manual de lançamentos vinculados a contas contábeis e destinatários, importação de recebíveis a partir de planilhas Excel, cadastro de destinatários e contas contábeis, histórico de emissões e exportação para Excel. <em>(demo com dados fictícios)</em>',

      'projects.fiscal.icon': 'Análise fiscal',
      'projects.fiscal.desc': 'Ferramenta interna de análise fiscal que começou como uma automação em VBA e precisou ser adaptada para rodar dentro do sistema da empresa. Processa notas de vendas e devoluções, concilia quantidades e valores de impostos (ICMS/DIFAL) agrupando por nota fiscal, filial, série e CFOP, com módulos de produtos, serviços e devoluções, log de auditoria de importação e exportação para Excel. <em>(demo com dados fictícios)</em>',

      'projects.cedro.icon': 'Loja de móveis',
      'projects.cedro.desc': 'Site de vitrine para uma loja de móveis fictícia: catálogo de produtos com filtros por cor e categoria, assistente virtual (chatbot) para agendar visita à loja, aviso automático de estoque baixo, e um painel administrativo separado para gerenciar produtos, depoimentos e agendamentos. <em>(login do admin: usuário <code>admin</code>, senha <code>cedrodecor2026</code>)</em>',

      'projects.clinic.icon': 'Gestão clínica',
      'projects.clinic.title': 'Consultório',
      'projects.clinic.desc': 'Sistema de gestão clínica para psicólogos: cadastro de pacientes com nível de complexidade, agenda de sessões, controle de pagamentos e relatórios financeiros com gráficos. <em>(demo com dados fictícios: crie uma conta com qualquer e-mail/senha para entrar)</em>',

      'projects.wedding.icon': 'Planner de casamento',
      'projects.wedding.desc': 'App romântico para planejar um casamento a dois: convidados, orçamento, fornecedores, checklist e contagem regressiva, com uma tela de entrada protegida por senha e animações autorais. <em>(demo pessoal, código de acesso: 0809)</em>',

      'projects.photo.icon': 'Fotografia',

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

      'hero.greeting': 'Hi, I’m',
      'hero.desc': 'I work with back-end and front-end development, automation and databases, building practical everyday solutions — from websites to internal systems.',
      'hero.cta_contact': 'Get in touch',
      'hero.cta_projects': 'View projects',

      'about.title': 'About',
      'about.p1': 'I’m a qualified IT technician with strong hands-on experience in databases, and I’m currently studying for a Bachelor’s degree in Computer Science at Uninter, focused on development.',
      'about.p2': 'I work professionally as a Development Assistant at IRKO Campinas. I like solving problems with code: automating repetitive tasks, building internal tools and developing systems from scratch.',

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
      'history.2.tag': 'Courses · Hashtag Programação',
      'history.2.title': 'Git &amp; GitHub / Programming Logic',
      'history.2.desc': 'Online courses focused on collaborative version control and the fundamentals of programming logic.',
      'history.3.tag': 'Current · IRKO Campinas',
      'history.3.title': 'Development Assistant',
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

      'projects.gourmet.icon': 'Gourmet popcorn',
      'projects.gourmet.desc': 'Online store for a gourmet popcorn brand, built to order. Flavour catalogue by category (Traditional and VIP), a custom bucket builder (size, quantity and up to 2 flavours), a full shopping cart with quantity control and subtotal, and checkout straight through WhatsApp. It includes an admin panel with authentication where the client herself adds, edits and removes catalogue flavours (with photo upload) without needing me for every change. The upload goes through a serverless function that validates the session before writing to Supabase Storage, without exposing any sensitive key in the browser.',

      'projects.receivables.icon': 'Accounts receivable',
      'projects.receivables.title': 'Accounts Receivable Issuing',
      'projects.receivables.desc': 'Internal receivables management system: manual issuing of entries linked to ledger accounts and recipients, importing receivables from Excel spreadsheets, registering recipients and ledger accounts, issuing history and Excel export. <em>(demo with fictitious data)</em>',

      'projects.fiscal.icon': 'Tax analysis',
      'projects.fiscal.desc': 'Internal tax analysis tool that started as a VBA automation and had to be adapted to run inside the company’s system. It processes sales and return invoices, reconciles tax quantities and amounts (ICMS/DIFAL) grouped by invoice, branch, series and CFOP, with modules for products, services and returns, an import audit log and Excel export. <em>(demo with fictitious data)</em>',

      'projects.cedro.icon': 'Furniture store',
      'projects.cedro.desc': 'Showcase site for a fictitious furniture store: product catalogue with colour and category filters, a virtual assistant (chatbot) to book a store visit, automatic low-stock alerts, and a separate admin panel to manage products, testimonials and appointments. <em>(admin login: user <code>admin</code>, password <code>cedrodecor2026</code>)</em>',

      'projects.clinic.icon': 'Clinic management',
      'projects.clinic.title': 'Clinic Manager',
      'projects.clinic.desc': 'Clinic management system for psychologists: patient records with complexity level, session scheduling, payment control and financial reports with charts. <em>(demo with fictitious data: create an account with any e-mail/password to get in)</em>',

      'projects.wedding.icon': 'Wedding planner',
      'projects.wedding.desc': 'A romantic app for planning a wedding together: guests, budget, vendors, checklist and countdown, with a password-protected entry screen and original animations. <em>(personal demo, access code: 0809)</em>',

      'projects.photo.icon': 'Photography',

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

      'hero.greeting': 'Hola, soy',
      'hero.desc': 'Trabajo con desarrollo back-end, front-end, automatizaciones y bases de datos, creando soluciones prácticas para el día a día, desde sitios web hasta sistemas internos.',
      'hero.cta_contact': 'Ponerse en contacto',
      'hero.cta_projects': 'Ver proyectos',

      'about.title': 'Sobre mí',
      'about.p1': 'Soy técnico en informática, titulado y con fuerte experiencia práctica en bases de datos, y actualmente curso la Licenciatura en Ciencia de la Computación en Uninter, con enfoque en desarrollo.',
      'about.p2': 'Trabajo profesionalmente como Asistente de Desarrollo en IRKO Campinas. Me gusta resolver problemas con código: automatizar tareas repetitivas, construir herramientas internas y desarrollar sistemas desde cero.',

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
      'history.2.tag': 'Cursos · Hashtag Programação',
      'history.2.title': 'Git &amp; GitHub / Lógica de Programación',
      'history.2.desc': 'Cursos en línea centrados en control de versiones colaborativo y fundamentos de lógica de programación.',
      'history.3.tag': 'Actual · IRKO Campinas',
      'history.3.title': 'Asistente de Desarrollo',
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

      'projects.gourmet.icon': 'Palomitas gourmet',
      'projects.gourmet.desc': 'Tienda online para una marca de palomitas gourmet, desarrollada por encargo. Catálogo de sabores por categoría (Tradicionales y VIP), un armador de baldes personalizados (tamaño, cantidad y hasta 2 sabores a elegir), carrito de compras completo con control de cantidad y subtotal, y finalización del pedido directamente por WhatsApp. Incluye un panel administrativo con autenticación, donde la propia clienta registra, edita y elimina sabores (con carga de foto) del catálogo sin depender de mí para cada cambio. La carga pasa por una función serverless que valida la sesión antes de guardar en Supabase Storage, sin exponer ninguna clave sensible en el navegador.',

      'projects.receivables.icon': 'Cuentas por cobrar',
      'projects.receivables.title': 'Emisión de Cuentas por Cobrar',
      'projects.receivables.desc': 'Sistema interno de gestión de cuentas por cobrar: emisión manual de asientos vinculados a cuentas contables y destinatarios, importación de cobros desde planillas de Excel, registro de destinatarios y cuentas contables, historial de emisiones y exportación a Excel. <em>(demo con datos ficticios)</em>',

      'projects.fiscal.icon': 'Análisis fiscal',
      'projects.fiscal.desc': 'Herramienta interna de análisis fiscal que empezó como una automatización en VBA y tuvo que adaptarse para funcionar dentro del sistema de la empresa. Procesa facturas de ventas y devoluciones, concilia cantidades y valores de impuestos (ICMS/DIFAL) agrupando por factura, sucursal, serie y CFOP, con módulos de productos, servicios y devoluciones, registro de auditoría de importación y exportación a Excel. <em>(demo con datos ficticios)</em>',

      'projects.cedro.icon': 'Tienda de muebles',
      'projects.cedro.desc': 'Sitio escaparate para una tienda de muebles ficticia: catálogo de productos con filtros por color y categoría, asistente virtual (chatbot) para agendar una visita a la tienda, aviso automático de stock bajo, y un panel administrativo aparte para gestionar productos, testimonios y citas. <em>(acceso admin: usuario <code>admin</code>, contraseña <code>cedrodecor2026</code>)</em>',

      'projects.clinic.icon': 'Gestión clínica',
      'projects.clinic.title': 'Consultorio',
      'projects.clinic.desc': 'Sistema de gestión clínica para psicólogos: registro de pacientes con nivel de complejidad, agenda de sesiones, control de pagos e informes financieros con gráficos. <em>(demo con datos ficticios: crea una cuenta con cualquier correo/contraseña para entrar)</em>',

      'projects.wedding.icon': 'Organizador de boda',
      'projects.wedding.desc': 'App romántica para planificar una boda en pareja: invitados, presupuesto, proveedores, checklist y cuenta regresiva, con una pantalla de entrada protegida por contraseña y animaciones propias. <em>(demo personal, código de acceso: 0809)</em>',

      'projects.photo.icon': 'Fotografía',

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

  function setAttrFromData(attrData, attrName) {
    document.querySelectorAll('[' + attrData + ']').forEach(function (el) {
      var value = dict()[el.getAttribute(attrData)];
      if (value != null) el.setAttribute(attrName, value);
    });
  }

  function apply(lang) {
    if (lang && DICT[lang]) current = lang;
    var d = dict();
    var meta = LANGS.filter(function (l) { return l.code === current; })[0] || LANGS[0];

    document.documentElement.setAttribute('lang', meta.htmlLang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = d[el.getAttribute('data-i18n')];
      // innerHTML porque algumas traduções carregam <em>/<code>; o conteúdo é
      // todo estático deste arquivo, não vem de entrada de usuário.
      if (value != null) el.innerHTML = value;
    });
    setAttrFromData('data-i18n-title', 'title');
    setAttrFromData('data-i18n-aria', 'aria-label');

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
    if (!DICT[lang]) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* modo privado */ }
    apply(lang);
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
