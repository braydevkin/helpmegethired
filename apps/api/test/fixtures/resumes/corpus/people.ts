export type Language = "en" | "pt";
export type Layout = "single-column" | "two-columns" | "canva-like" | "latex-like" | "linkedin-export";

export interface Period {
  start: string;
  end: string | null;
}

export interface ExperienceData {
  role: string;
  company: string;
  location: string;
  period: Period | null;
  bullets: string[];
  companyFirst?: boolean;
}

export interface EducationData {
  institution: string;
  degree: string;
  period: Period;
}

export interface ProjectData {
  name: string;
  description: string;
  url: string | null;
}

export interface CertificationData {
  name: string;
  issuer: string;
  year: number;
}

export interface Person {
  slug: string;
  language: Language;
  layout: Layout;
  name: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string | null;
  website: string | null;
  summary: string;
  experiences: ExperienceData[];
  education: EducationData[];
  skills: string[];
  projects: ProjectData[];
  languages: string[];
  certifications: CertificationData[];
}

// Every person, company, and address is invented. Keep it that way: the corpus is committed.
export const people: Person[] = [
  {
    slug: "ada-single-column-en",
    language: "en",
    layout: "single-column",
    name: "Ada Lovelace",
    headline: "Senior Backend Engineer",
    location: "London, United Kingdom",
    email: "ada.lovelace@example.com",
    phone: "+44 20 7946 0958",
    linkedin: "linkedin.com/in/ada-lovelace-example",
    github: "github.com/ada-example",
    website: null,
    summary:
      "Backend engineer with ten years building queues, ingestion pipelines, and the services around them. Comfortable owning a system from the schema to the on-call rota.",
    experiences: [
      {
        role: "Senior Backend Engineer",
        company: "Analytical Engines Ltd",
        location: "London",
        period: { start: "Mar 2021", end: null },
        bullets: [
          "Own the ingestion platform that turns uploaded documents into structured profiles.",
          "Cut the median processing time from 40 seconds to 6 by moving extraction to a worker pool.",
          "Mentor four engineers and run the design reviews for the data team.",
        ],
      },
      {
        role: "Backend Engineer",
        company: "Difference Works",
        location: "Manchester",
        period: { start: "Jun 2016", end: "Feb 2021" },
        bullets: [
          "Built the billing service in TypeScript on PostgreSQL, handling 2 million invoices a month.",
          "Introduced contract tests between the API and the web app.",
        ],
      },
    ],
    education: [
      { institution: "University of Cambridge", degree: "MSc in Computer Science", period: { start: "2014", end: "2016" } },
      { institution: "University of Leeds", degree: "BSc in Mathematics", period: { start: "2011", end: "2014" } },
    ],
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Redis", "Docker", "Kubernetes", "AWS", "Terraform"],
    projects: [
      {
        name: "Difference Engine",
        description: "A mechanical calculator for polynomial functions, rebuilt as a web simulator.",
        url: "https://github.com/ada-example/difference-engine",
      },
    ],
    languages: ["English - Native", "French - Intermediate (B1)"],
    certifications: [{ name: "AWS Solutions Architect Associate", issuer: "Amazon Web Services", year: 2023 }],
  },
  {
    slug: "ada-single-column-pt",
    language: "pt",
    layout: "single-column",
    name: "Ada Lovelace",
    headline: "Engenheira de Software Sênior (Backend)",
    location: "Londres, Reino Unido",
    email: "ada.lovelace@example.com",
    phone: "+44 20 7946 0958",
    linkedin: "linkedin.com/in/ada-lovelace-example",
    github: "github.com/ada-example",
    website: null,
    summary:
      "Engenheira backend com dez anos construindo filas, pipelines de ingestão e os serviços ao redor. Confortável em cuidar de um sistema do esquema ao plantão.",
    experiences: [
      {
        role: "Engenheira de Software Sênior",
        company: "Analytical Engines Ltd",
        location: "Londres",
        period: { start: "mar 2021", end: null },
        bullets: [
          "Responsável pela plataforma de ingestão que transforma documentos enviados em perfis estruturados.",
          "Reduziu o tempo mediano de processamento de 40 segundos para 6 ao mover a extração para um pool de workers.",
          "Mentora de quatro pessoas engenheiras e responsável pelas revisões de design do time de dados.",
        ],
      },
      {
        role: "Engenheira de Software",
        company: "Difference Works",
        location: "Manchester",
        period: { start: "jun 2016", end: "fev 2021" },
        bullets: [
          "Construiu o serviço de cobrança em TypeScript sobre PostgreSQL, processando 2 milhões de faturas por mês.",
          "Introduziu testes de contrato entre a API e o aplicativo web.",
        ],
      },
    ],
    education: [
      { institution: "University of Cambridge", degree: "Mestrado em Ciência da Computação", period: { start: "2014", end: "2016" } },
      { institution: "University of Leeds", degree: "Bacharelado em Matemática", period: { start: "2011", end: "2014" } },
    ],
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Redis", "Docker", "Kubernetes", "AWS", "Terraform"],
    projects: [
      {
        name: "Difference Engine",
        description: "Uma calculadora mecânica de funções polinomiais, reconstruída como simulador web.",
        url: "https://github.com/ada-example/difference-engine",
      },
    ],
    languages: ["Inglês - Nativo", "Francês - Intermediário (B1)"],
    certifications: [{ name: "AWS Solutions Architect Associate", issuer: "Amazon Web Services", year: 2023 }],
  },
  {
    slug: "bruno-two-columns-pt",
    language: "pt",
    layout: "two-columns",
    name: "Bruno Henrique da Silva",
    headline: "Desenvolvedor Full Stack",
    location: "Belo Horizonte, MG",
    email: "bruno.hsilva@example.com",
    phone: "(31) 98877-6655",
    linkedin: "linkedin.com/in/bruno-hsilva-example",
    github: "github.com/brunohs-example",
    website: null,
    summary:
      "Desenvolvedor full stack com sete anos entre React, Node.js e bancos relacionais. Gosto de produtos pequenos com times pequenos e de código que dá para ler.",
    experiences: [
      {
        role: "Desenvolvedor Full Stack Pleno",
        company: "Mineral Digital",
        location: "Belo Horizonte",
        period: { start: "08/2020", end: null },
        bullets: [
          "Desenvolve o portal do cliente em React e a API em NestJS.",
          "Migrou a autenticação para códigos de uso único, eliminando as senhas.",
        ],
      },
      {
        role: "Desenvolvedor Júnior",
        company: "Alameda Sistemas",
        location: "Contagem",
        period: { start: "02/2018", end: "07/2020" },
        bullets: ["Manteve o ERP em PHP e escreveu os primeiros testes automatizados da empresa."],
      },
    ],
    education: [{ institution: "PUC Minas", degree: "Tecnólogo em Análise e Desenvolvimento de Sistemas", period: { start: "2015", end: "2017" } }],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "NestJS", "PostgreSQL", "Docker", "Git"],
    projects: [
      { name: "Fila Zero", description: "Aplicativo de senhas para postos de saúde, feito em um fim de semana de hackathon.", url: null },
    ],
    languages: ["Português - Nativo", "Inglês - Avançado"],
    certifications: [{ name: "Scrum Foundation Professional", issuer: "CertiProf", year: 2021 }],
  },
  {
    slug: "carla-canva-like-en",
    language: "en",
    layout: "canva-like",
    name: "Carla Mendes Ribeiro",
    headline: "Product Designer & Front-end Developer",
    location: "Lisbon, Portugal",
    email: "carla.ribeiro@example.com",
    phone: "+351 912 345 678",
    linkedin: "linkedin.com/in/carla-ribeiro-example",
    github: null,
    website: "https://carlaribeiro.example.com",
    summary: "Designer who codes. I prototype in Figma, ship in React, and measure what happens after.",
    experiences: [
      {
        role: "Product Designer",
        company: "Tagus Labs",
        location: "Lisbon",
        period: { start: "January 2022", end: null },
        bullets: ["Redesigned the onboarding flow, lifting activation from 31% to 47%.", "Maintain the design system used by three product teams."],
      },
      {
        role: "Front-end Developer",
        company: "Azul Interactive",
        location: "Porto",
        period: { start: "September 2018", end: "December 2021" },
        bullets: ["Built marketing sites and web apps in React and Next.js for retail clients."],
      },
    ],
    education: [{ institution: "Universidade de Lisboa", degree: "BA in Communication Design", period: { start: "2014", end: "2018" } }],
    skills: ["Figma", "React", "Next.js", "TypeScript", "CSS", "Accessibility", "User research"],
    projects: [{ name: "Tile", description: "A colour contrast checker for design tokens.", url: "https://carlaribeiro.example.com/tile" }],
    languages: ["Portuguese - Native", "English - Fluent", "Spanish - Basic"],
    certifications: [],
  },
  {
    slug: "diego-latex-like-pt",
    language: "pt",
    layout: "latex-like",
    name: "Diego Alves Ferreira",
    headline: "Engenheiro de Dados",
    location: "Curitiba, PR",
    email: "diego.ferreira@example.com",
    phone: "+55 41 99123-4567",
    linkedin: "linkedin.com/in/diego-ferreira-example",
    github: "github.com/diegoaf-example",
    website: null,
    summary:
      "Engenheiro de dados focado em pipelines batch e streaming sobre Spark e Kafka, com atenção especial a custo e a qualidade de dados.",
    experiences: [
      {
        role: "Engenheiro de Dados Sênior",
        company: "Pinheiro Analytics",
        location: "Curitiba",
        period: { start: "abril de 2019", end: null },
        bullets: [
          "Lidera a plataforma de dados que atende 40 analistas.",
          "Reduziu 35% do custo de armazenamento ao reorganizar o data lake em camadas.",
        ],
      },
      {
        role: "Analista de Dados",
        company: "Cooperativa Araucária",
        location: "Curitiba",
        period: { start: "mar. 2016", end: "mar. 2019" },
        bullets: ["Construiu os primeiros painéis de vendas em SQL e Python."],
      },
    ],
    education: [
      { institution: "Universidade Federal do Paraná", degree: "Bacharelado em Ciência da Computação", period: { start: "2012", end: "2016" } },
    ],
    skills: ["Python", "SQL", "Spark", "Kafka", "Airflow", "AWS", "dbt", "PostgreSQL"],
    projects: [],
    languages: ["Português - Nativo", "Inglês - Fluente", "Espanhol - Intermediário"],
    certifications: [
      { name: "Databricks Certified Data Engineer Associate", issuer: "Databricks", year: 2022 },
      { name: "AWS Certified Data Analytics", issuer: "Amazon Web Services", year: 2021 },
    ],
  },
  {
    slug: "elena-linkedin-export-en",
    language: "en",
    layout: "linkedin-export",
    name: "Elena Petrova",
    headline: "Engineering Manager at Northwind Systems",
    location: "Berlin, Germany",
    email: "elena.petrova@example.com",
    phone: "+49 30 901820",
    linkedin: "www.linkedin.com/in/elena-petrova-example",
    github: null,
    website: null,
    summary:
      "Engineering manager for two platform teams. Before that, eight years as a backend engineer in payments. I care about clear ownership and boring infrastructure.",
    experiences: [
      {
        role: "Engineering Manager",
        company: "Northwind Systems",
        location: "Berlin",
        period: { start: "October 2020", end: null },
        bullets: ["Lead the platform and reliability teams, twelve engineers in total.", "Introduced quarterly reliability reviews."],
      },
      {
        role: "Senior Software Engineer",
        company: "Northwind Systems",
        location: "Berlin",
        period: { start: "May 2017", end: "September 2020" },
        bullets: ["Designed the ledger service in Go on PostgreSQL."],
      },
      {
        role: "Software Engineer",
        company: "Baltic Pay",
        location: "Tallinn",
        period: { start: "January 2013", end: "April 2017" },
        bullets: ["Built card processing integrations in Java."],
      },
    ],
    education: [{ institution: "Tallinn University of Technology", degree: "MSc, Computer Science", period: { start: "2011", end: "2013" } }],
    skills: ["Engineering Management", "Go", "PostgreSQL", "Kubernetes"],
    projects: [],
    languages: ["Russian - Native", "English - Fluent", "German - Intermediate"],
    certifications: [],
  },
  {
    slug: "felipe-linkedin-export-pt",
    language: "pt",
    layout: "linkedin-export",
    name: "Felipe Costa Nascimento",
    headline: "Analista de Suporte Técnico na Serra Telecom",
    location: "Recife, Pernambuco, Brasil",
    email: "felipe.nascimento@example.com",
    phone: "(81) 3033-1234",
    linkedin: "www.linkedin.com/in/felipe-nascimento-example",
    github: null,
    website: null,
    summary:
      "Analista de suporte em transição para desenvolvimento. Estudo JavaScript à noite e automatizo o que posso no trabalho com Python.",
    experiences: [
      {
        role: "Analista de Suporte Técnico",
        company: "Serra Telecom",
        location: "Recife",
        period: { start: "junho de 2021", end: null },
        bullets: ["Atende o segundo nível de suporte da rede de fibra.", "Automatizou o relatório diário de chamados em Python."],
      },
      {
        role: "Estagiário de TI",
        company: "Prefeitura de Olinda",
        location: "Olinda",
        period: { start: "fevereiro de 2020", end: "maio de 2021" },
        bullets: ["Deu manutenção em estações de trabalho e na rede local."],
      },
    ],
    education: [{ institution: "IFPE", degree: "Tecnólogo em Redes de Computadores", period: { start: "2018", end: "2021" } }],
    skills: ["Redes", "Python", "JavaScript", "Linux"],
    projects: [],
    languages: ["Português - Nativo", "Inglês - Básico"],
    certifications: [{ name: "CCNA", issuer: "Cisco", year: 2022 }],
  },
  {
    slug: "grace-two-columns-en",
    language: "en",
    layout: "two-columns",
    name: "Grace Brewster Hopper",
    headline: "Staff Software Engineer",
    location: "New York, NY",
    email: "grace.hopper@example.com",
    phone: "+1 (212) 555-0142",
    linkedin: "linkedin.com/in/grace-hopper-example",
    github: "github.com/gracebh-example",
    website: "https://gracehopper.example.com",
    summary: "Staff engineer working on compilers and developer tooling. I like removing steps from other people's days.",
    experiences: [
      {
        role: "Staff Software Engineer",
        company: "Harvard Computation Co",
        location: "New York",
        period: { start: "2019", end: null },
        bullets: ["Lead the build tooling group.", "Cut CI time in half by caching compiler outputs."],
      },
      {
        role: "Senior Software Engineer",
        company: "Eckert-Mauchly",
        location: "Philadelphia",
        period: { start: "2014", end: "2019" },
        bullets: ["Wrote the first optimising passes of the in-house compiler."],
      },
      {
        role: "Software Engineer",
        company: "Remington Systems",
        location: "Philadelphia",
        period: { start: "2010", end: "2014" },
        bullets: ["Maintained the COBOL runtime."],
      },
    ],
    education: [{ institution: "Yale University", degree: "PhD in Mathematics", period: { start: "2004", end: "2010" } }],
    skills: ["C++", "Rust", "LLVM", "Bazel", "Python", "Linux"],
    projects: [{ name: "Moth", description: "A tiny bug tracker that lives in the repository.", url: "https://github.com/gracebh-example/moth" }],
    languages: ["English - Native"],
    certifications: [],
  },
  {
    slug: "helena-single-column-pt",
    language: "pt",
    layout: "single-column",
    name: "Helena Martins Rocha",
    headline: "Engenheira de Software",
    location: "Florianópolis, SC",
    email: "helena.rocha@example.com",
    phone: "(48) 99876-5432",
    linkedin: "linkedin.com/in/helena-rocha-example",
    github: "github.com/helenamr-example",
    website: null,
    summary: "Engenheira de software que mantém um trabalho fixo e uma consultoria em paralelo, sem deixar nenhum dos dois cair.",
    experiences: [
      {
        role: "Engenheira de Software Sênior",
        company: "Ilha Tech",
        location: "Florianópolis",
        period: { start: "01/2020", end: null },
        bullets: ["Lidera o time da API de pagamentos.", "Reduziu o tempo de build de 20 para 6 minutos."],
      },
      {
        role: "Consultora de Software",
        company: "Rocha Consultoria",
        location: "Remoto",
        period: { start: "06/2019", end: "12/2022" },
        bullets: ["Atendeu cinco clientes em paralelo com o trabalho fixo.", "Projetos de integração em Node.js e PostgreSQL."],
      },
      {
        role: "Engenheira de Software",
        company: "Litoral Digital",
        location: "Florianópolis",
        period: { start: "03/2017", end: "12/2019" },
        bullets: ["Desenvolveu o aplicativo de entregas em React Native."],
      },
    ],
    education: [{ institution: "UFSC", degree: "Bacharelado em Sistemas de Informação", period: { start: "2013", end: "2016" } }],
    skills: ["TypeScript", "Node.js", "React Native", "PostgreSQL", "AWS"],
    projects: [],
    languages: ["Português - Nativo", "Inglês - Avançado"],
    certifications: [],
  },
  {
    slug: "igor-latex-like-en",
    language: "en",
    layout: "latex-like",
    name: "Igor Sokolov",
    headline: "Site Reliability Engineer",
    location: "Amsterdam, Netherlands",
    email: "igor.sokolov@example.com",
    phone: "+31 20 123 4567",
    linkedin: "linkedin.com/in/igor-sokolov-example",
    github: "github.com/igorsk-example",
    website: null,
    summary: "SRE with a taste for boring systems and clear runbooks.",
    experiences: [
      {
        role: "Site Reliability Engineer",
        company: "Canal Cloud",
        location: "Amsterdam",
        period: { start: "2021", end: null },
        bullets: ["Own the on-call rotation and the incident process for the platform.", "Brought the error budget policy to every product team."],
        companyFirst: true,
      },
      {
        role: "Systems Engineer",
        company: "Tulip Hosting",
        location: "Utrecht",
        period: { start: "2016", end: "2021" },
        bullets: ["Ran the fleet of 400 servers and moved it to Kubernetes."],
        companyFirst: true,
      },
    ],
    education: [{ institution: "TU Delft", degree: "BSc in Computer Science", period: { start: "2012", end: "2016" } }],
    skills: ["Kubernetes", "Terraform", "Go", "Prometheus", "Linux", "AWS"],
    projects: [],
    languages: ["Russian - Native", "English - Fluent", "Dutch - Intermediate"],
    certifications: [{ name: "Certified Kubernetes Administrator", issuer: "CNCF", year: 2022 }],
  },
  {
    slug: "julia-canva-like-pt",
    language: "pt",
    layout: "canva-like",
    name: "Júlia Andrade Lima",
    headline: "Desenvolvedora Front-end",
    location: "Porto Alegre, RS",
    email: "julia.lima@example.com",
    phone: "(51) 98123-4567",
    linkedin: "linkedin.com/in/julia-lima-example",
    github: "github.com/julialima-example",
    website: null,
    summary: "Desenvolvedora front-end em seu primeiro emprego, cuidando do design system e da acessibilidade do produto.",
    experiences: [
      {
        role: "Desenvolvedora Front-end Júnior",
        company: "Guaíba Software",
        location: "Porto Alegre",
        period: { start: "03/2023", end: null },
        bullets: ["Mantém o design system em React e Storybook.", "Levou o produto ao nível AA de acessibilidade."],
      },
    ],
    education: [{ institution: "PUCRS", degree: "Bacharelado em Ciência da Computação", period: { start: "2019", end: "2022" } }],
    skills: ["React", "TypeScript", "CSS", "Storybook", "Jest"],
    projects: [{ name: "Acessível", description: "Extensão de navegador que aponta problemas de contraste.", url: "https://github.com/julialima-example/acessivel" }],
    languages: ["Português - Nativo", "Inglês - Intermediário"],
    certifications: [],
  },
  {
    slug: "kenji-single-column-en",
    language: "en",
    layout: "single-column",
    name: "Kenji Nakamura",
    headline: "Mobile Engineer",
    location: "Vancouver, Canada",
    email: "kenji.nakamura@example.com",
    phone: "+1 (604) 555-0177",
    linkedin: "linkedin.com/in/kenji-nakamura-example",
    github: "github.com/kenjin-example",
    website: null,
    summary: "Mobile engineer shipping iOS and Android apps, and teaching on weekends.",
    experiences: [
      {
        role: "Senior Mobile Engineer",
        company: "Pacific Apps",
        location: "Vancouver",
        period: { start: "February 2022", end: null },
        bullets: ["Lead the shared Kotlin Multiplatform layer used by both apps.", "Cut crash-free sessions below 0.3% of users."],
      },
      {
        role: "Mobile Engineer",
        company: "Harbour Media",
        location: "Vancouver",
        period: { start: "August 2018", end: "January 2022" },
        bullets: ["Built the news app for iOS in Swift."],
      },
      {
        role: "Volunteer Instructor",
        company: "Code Club Vancouver",
        location: "Vancouver",
        period: null,
        bullets: ["Teach children to program on Saturdays."],
      },
    ],
    education: [{ institution: "University of British Columbia", degree: "BSc in Computer Science", period: { start: "2014", end: "2018" } }],
    skills: ["Swift", "Kotlin", "Kotlin Multiplatform", "SwiftUI", "GraphQL"],
    projects: [],
    languages: ["English - Native", "Japanese - Fluent"],
    certifications: [],
  },
  {
    slug: "laura-two-columns-en",
    language: "en",
    layout: "two-columns",
    name: "Laura Bianchi",
    headline: "Data Analyst",
    location: "Milan, Italy",
    email: "laura.bianchi@example.com",
    phone: "+39 02 1234 5678",
    linkedin: "linkedin.com/in/laura-bianchi-example",
    github: null,
    website: null,
    summary: "Data analyst turning warehouse tables into decisions, with SQL and a little Python.",
    experiences: [
      {
        role: "Senior Data Analyst",
        company: "Navigli Retail",
        location: "Milan",
        period: { start: "Jan 2021", end: null },
        bullets: ["Own the sales reporting for 120 stores.", "Built the demand forecast that drives replenishment."],
      },
      {
        role: "Data Analyst",
        company: "Lombardia Insights",
        location: "Milan",
        period: { start: "Sep 2018", end: "Dec 2020" },
        bullets: ["Delivered dashboards for retail and logistics clients."],
      },
    ],
    education: [{ institution: "Politecnico di Milano", degree: "MSc in Management Engineering", period: { start: "2016", end: "2018" } }],
    skills: ["SQL", "Python", "dbt", "Power BI", "Snowflake"],
    projects: [],
    languages: ["Italian - Native", "English - Fluent"],
    certifications: [],
  },
  {
    slug: "marcos-linkedin-export-pt",
    language: "pt",
    layout: "linkedin-export",
    name: "Marcos Vinícius Pereira",
    headline: "Gerente de Engenharia na Sertão Digital",
    location: "Fortaleza, Ceará, Brasil",
    email: "marcos.pereira@example.com",
    phone: "(85) 99988-7766",
    linkedin: "www.linkedin.com/in/marcos-pereira-example",
    github: null,
    website: null,
    summary: "Gerente de engenharia de dois times de produto. Antes disso, dez anos como desenvolvedor backend.",
    experiences: [
      {
        role: "Gerente de Engenharia",
        company: "Sertão Digital",
        location: "Fortaleza",
        period: { start: "março de 2016", end: null },
        bullets: ["Lidera dois times de produto, quatorze pessoas ao todo."],
      },
      {
        role: "Desenvolvedor Backend Sênior",
        company: "Sertão Digital",
        location: "Fortaleza",
        period: { start: "janeiro de 2012", end: "fevereiro de 2016" },
        bullets: ["Projetou o serviço de pedidos em Java sobre PostgreSQL."],
      },
    ],
    education: [{ institution: "Universidade Federal do Ceará", degree: "Bacharelado em Computação", period: { start: "2007", end: "2011" } }],
    skills: ["Gestão de Engenharia", "Java", "PostgreSQL"],
    projects: [],
    languages: ["Português - Nativo", "Inglês - Avançado"],
    certifications: [],
  },
  {
    slug: "nina-latex-like-pt",
    language: "pt",
    layout: "latex-like",
    name: "Nina Carvalho Duarte",
    headline: "Cientista de Dados",
    location: "Campinas, SP",
    email: "nina.duarte@example.com",
    phone: "+55 19 98765-1234",
    linkedin: "linkedin.com/in/nina-duarte-example",
    github: "github.com/ninacd-example",
    website: null,
    summary: "Cientista de dados aplicando modelos de previsão a logística, com o pé na engenharia de dados.",
    experiences: [
      {
        role: "Cientista de Dados",
        company: "Rota Logística",
        location: "Campinas",
        period: { start: "2020", end: null },
        bullets: ["Modelos de previsão de demanda para 300 rotas.", "Pipeline de features em Spark."],
      },
      {
        role: "Analista de Dados",
        company: "Unicamp Ventures",
        location: "Campinas",
        period: { start: "2015", end: "2017" },
        bullets: ["Painéis de acompanhamento das startups incubadas."],
      },
    ],
    education: [{ institution: "Unicamp", degree: "Mestrado em Estatística", period: { start: "2017", end: "2019" } }],
    skills: ["Python", "Pandas", "scikit-learn", "Spark", "SQL"],
    projects: [],
    languages: ["Português - Nativo", "Inglês - Fluente"],
    certifications: [],
  },
  {
    slug: "otto-single-column-en",
    language: "en",
    layout: "single-column",
    name: "Otto Lindqvist",
    headline: "Embedded Software Engineer",
    location: "Gothenburg, Sweden",
    email: "otto.lindqvist@example.com",
    phone: "+46 31 123 456",
    linkedin: "linkedin.com/in/otto-lindqvist-example",
    github: "github.com/ottol-example",
    website: null,
    summary: "Embedded engineer who has spent his whole career on one product line and knows every one of its boards.",
    experiences: [
      {
        role: "Embedded Software Engineer",
        company: "Nordic Drives",
        location: "Gothenburg",
        period: { start: "Jan 2012", end: null },
        bullets: ["Firmware in C and Rust for the motor controllers.", "Introduced hardware-in-the-loop tests to the release process."],
        companyFirst: true,
      },
    ],
    education: [{ institution: "Chalmers University of Technology", degree: "MSc in Embedded Systems", period: { start: "2007", end: "2012" } }],
    skills: ["C", "Rust", "RTOS", "CAN bus", "Git"],
    projects: [],
    languages: ["Swedish - Native", "English - Fluent"],
    certifications: [],
  },
];
