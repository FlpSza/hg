const express = require("express");
const path = require("path");
const axios = require("axios");
const db = require("./db/connection");
const app = express();
const session = require("express-session");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const cron = require("node-cron");
const pagarme = require("pagarme");
const fs = require("fs");
// const fetch = require('node-fetch');
const PORT = 3000;
require("dotenv").config();

// Middleware para permitir o envio de dados JSON
app.use(express.json());

// Servir os arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Configuração do express-session
app.use(
  session({
    secret: "segredo", // Substitua por uma chave secreta segura
    resave: false, // Não regrava a sessão se não houver alterações
    saveUninitialized: true, // Salva sessões mesmo sem dados
    cookie: { secure: false }, // Se estiver usando HTTPS, altere para true
  })
);

app.use(
  cors({
    origin: "*", // Permitir todas as origens
    methods: ["GET", "POST", "OPTIONS"], // Métodos permitidos
    allowedHeaders: ["Content-Type", "Authorization"], // Cabeçalhos permitidos
  })
);

// Configuração da API (substitua pelas suas credenciais)
const PIX_API_URL = "https://cdpj.partners.bancointer.com.br/oauth/v2/token"; // Substitua pelo endpoint correto
const CLIENT_ID = "3fea13df-1e68-447c-b306-a87d7c058024"; // Armazene o client_id no .env
const CLIENT_SECRET = "79f8d856-bb83-4ada-a5d0-01b22cfe43c1"; // Armazene o client_secret no .env
const CERT_PATH = "./certificados/Inter API_Certificado.crt";
const KEY_PATH = "./certificados/Inter API_Chave.key";
// Caminhos para os arquivos de certificado e chave privada
const certPath = path.resolve(
  __dirname,
  "certificados/Inter API_Certificado.crt"
);
const keyPath = path.resolve(__dirname, "certificados/Inter API_Chave.key");

// Rota principal
app.get("/", (req, res) => {
o});

// Rota para testar conexão com o banco de dados
app.get("/test-connection", async (req, res) => {
  pool.connect((err) => {
    if (err) {
      console.error("Erro ao conectar ao banco de dados:", err);
      return res.status(500).json({
        success: false,
        message: "Erro ao conectar ao banco de dados.",
        error: err.message,
      });
    }
    console.log("Conexão bem-sucedida ao banco de dados!");
    return res.status(200).json({
      success: true,
      message: "Conexão bem-sucedida ao banco de dados!",
    });
  });
});

// Rota para processar o registro de usuário
app.post("/register", (req, res) => {
  const { username, email, phone, password } = req.body;

  // Validar os dados do usuário
  if (!username || !email || !phone || !password) {
    return res
      .status(400)
      .json({ message: "Todos os campos são obrigatórios." });
  }

  // Lógica de salvamento no banco de dados (simulação)
  const query =
    "INSERT INTO users (username, email, phone, password) VALUES (?, ?, ?, ?)";
  db.query(query, [username, email, phone, password], (err, result) => {
    if (err) {
      console.error("Erro ao salvar o usuário:", err);
      return res
        .status(500)
        .json({ message: "Erro ao salvar o usuário no banco de dados." });
    }

    // Retorna uma resposta de sucesso
    return res.status(200).json({ message: "Usuário cadastrado com sucesso!" });
  });

  console.log("Novo usuário cadastrado:", { username, email, phone, password });

  // Retorna uma resposta de sucesso
  return res.status(200).json({ message: "Usuário cadastrado com sucesso!" });
});

// Rota para processar o login de usuário
app.post("/login", async (req, res) => {
  const { email, pass } = req.body;

  // Verificar se o nome de usuário e senha foram informados
  if (!email || !pass) {
    return res
      .status(400)
      .json({ message: "Nome de usuário e senha são obrigatórios." });
  }

  try {
    // Buscar o usuário no banco de dados pelo nome de usuário
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Usuário não encontrado." });
    }

    const user = rows[0];

    // Comparar a senha fornecida com a senha armazenada (sem hashing)
    if (user.password !== pass) {
      return res.status(401).json({ message: "Senha incorreta." });
    }

    // Resposta de login bem-sucedido
    res.status(200).json({ message: "Login bem-sucedido!", email: user.email });
  } catch (error) {
    console.error("Erro ao processar login:", error);
    res.status(500).json({ message: "Erro ao realizar login." });
  }
});

// Endpoint para criar cliente
app.post("/cadastrar-cliente", async (req, res) => {
  const clienteData = req.body;

  try {
    // Enviar dados para o Pagar.me
    console.log("Enviando dados para o Pagar.me...");
    const response = await axios.post(
      "https://api.pagar.me/core/v5/customers",
      {
        address: {
          state: clienteData.address_state,
          country: clienteData.address_country,
          city: clienteData.address_city,
          zip_code: clienteData.address_zip_code,
          line_1: clienteData.address_line_1,
        },
        phones: {
          mobile_phone: {
            area_code: clienteData.phone_area_code,
            number: clienteData.phone_number,
            country_code: clienteData.phone_area_code,
          },
        },
        birthdate: clienteData.birthdate,
        name: clienteData.name,
        email: clienteData.email,
        document_type: "CPF",
        document: clienteData.document,
        type: "individual",
      },
      {
        headers: {
          accept: "application/json",
          authorization:
            "Basic c2tfdGVzdF9lMzU5MjJmNmFmNzI0ZWRjOWM1NGE0NWI0ZWRjZjBmYTo=",
          "content-type": "application/json",
        },
      }
    );

    console.log("Cliente cadastrado no Pagar.me:", response.data);

    // 1. Verificar se o email já existe na tabela users
    const checkEmailUsersQuery = "SELECT id FROM users WHERE email = ? LIMIT 1";
    const [userResult] = await db.query(checkEmailUsersQuery, [
      clienteData.email,
    ]);

    if (userResult.length === 0) {
      console.log(
        "Email não encontrado na tabela users, criando novo usuário..."
      );
      // Se não existir, criamos um novo usuário
      const genericPassword = crypto.randomBytes(4).toString("hex"); // Gerar senha genérica
      const insertUserQuery =
        "INSERT INTO users (username, email, phone, password) VALUES (?, ?, ?, ?)";
      const [insertUserResult] = await db.query(insertUserQuery, [
        clienteData.name,
        clienteData.email,
        clienteData.phone_number,
        genericPassword,
      ]);
      console.log(
        `Novo usuário criado na tabela users com ID: ${insertUserResult.insertId}`
      );
    } else {
      console.log(
        "Email encontrado na tabela users, não foi necessário criar novo usuário."
      );
    }

    // 2. Verificar se o email já existe na tabela user_data
    const checkEmailUserDataQuery =
      "SELECT id FROM user_data WHERE email = ? LIMIT 1";
    const [userDataResult] = await db.query(checkEmailUserDataQuery, [
      clienteData.email,
    ]);

    if (userDataResult.length === 0) {
      console.log(
        "Email não encontrado na tabela user_data, criando novo registro..." + "dados recebidos: " + JSON.stringify(response.data, null, 2)
      );

      // Se não existir, criamos um novo registro em user_data
      const insertUserDataQuery = `INSERT INTO user_data (
        id, 
        name, 
        email, 
        document, 
        document_type, 
        type, 
        delinquent, 
        address_id, 
        address_line_1, 
        zip_code, 
        city, 
        state, 
        country, 
        birthdate, 
        mobile_phone_country_code, 
        mobile_phone_number, 
        mobile_phone_area_code, 
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      await db.query(insertUserDataQuery, [
        response.data.id, // pagarme_id
        response.data.name, // name
        response.data.email, // email
        response.data.document, // document (CPF)
        response.data.document_type, // document_type (cpf)
        response.data.type, // type (individual)
        response.data.delinquent, // delinquent (false/true)
        response.data.address.id, // address_id (ID do endereço)
        response.data.address.line_1, // address_line_1 (Rua alair, nº 157)
        response.data.address.zip_code, // zip_code (21630030)
        response.data.address.city, // city (Rio de Janeiro)
        response.data.address.state, // state (RJ)
        response.data.address.country, // country (BR)
        response.data.birthdate, // birthdate (1994-12-31)
        response.data.phones.mobile_phone.country_code, // mobile_phone_country_code (21)
        response.data.phones.mobile_phone.number, // mobile_phone_number (971511007)
        response.data.phones.mobile_phone.area_code, // mobile_phone_area_code (21)
        new Date(), // created_at (data atual)
        new Date(), // updated_at (data atual)
      ]);
      
      console.log("Novo cliente registrado na tabela user_data!");
    } else {
      console.log(
        "Email encontrado na tabela user_data, atualizando dados..."
      );
    
      // Atualizar os dados do cliente na tabela user_data
      const updateUserDataQuery = `UPDATE user_data SET
        name = ?, 
        document = ?, 
        document_type = ?, 
        type = ?, 
        delinquent = ?, 
        address_id = ?, 
        address_line_1 = ?, 
        zip_code = ?, 
        city = ?, 
        state = ?, 
        country = ?, 
        birthdate = ?, 
        mobile_phone_country_code = ?, 
        mobile_phone_number = ?, 
        mobile_phone_area_code = ?, 
        updated_at = ?
      WHERE email = ?`;
    
      await db.query(updateUserDataQuery, [
        response.data.name, // name
        response.data.document, // document (CPF)
        response.data.document_type, // document_type (cpf)
        response.data.type, // type (individual)
        response.data.delinquent, // delinquent (false/true)
        response.data.address.id, // address_id (ID do endereço)
        response.data.address.line_1, // address_line_1 (Rua alair, nº 157)
        response.data.address.zip_code, // zip_code (21630030)
        response.data.address.city, // city (Rio de Janeiro)
        response.data.address.state, // state (RJ)
        response.data.address.country, // country (BR)
        response.data.birthdate, // birthdate (1994-12-31)
        response.data.phones.mobile_phone.country_code, // mobile_phone_country_code (21)
        response.data.phones.mobile_phone.number, // mobile_phone_number (971511007)
        response.data.phones.mobile_phone.area_code, // mobile_phone_area_code (21)
        new Date(), // updated_at (data atual)
        clienteData.email, // email (para identificar o registro a ser atualizado)
      ]);
    
      console.log("Dados do cliente atualizados na tabela user_data!");
    }
    

    // 3. Se for um novo usuário, enviar o email de confirmação
    if (userResult.length === 0) {
      const transporter = nodemailer.createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        auth: {
          user: "confirmacao@higoviagens.com",
          pass: "Confirmacao25.",
        },
      });

      const mailOptions = {
        from: "confirmacao@higoviagens.com",
        to: clienteData.email,
        subject: "Bem-vindo à nossa plataforma!",
        text: `Olá ${clienteData.name},\n\nSeu usuário foi criado com sucesso!\n\nSenha de acesso: ${genericPassword}\n\nPor favor, altere sua senha após o primeiro login.\n\nAtenciosamente,\nEquipe.`,
      };

      await transporter.sendMail(mailOptions);
      console.log("Email enviado com sucesso!");
    }

    return res
      .status(200)
      .json({
        message: "Cliente cadastrado com sucesso!",
        data: response.data,
      });
  } catch (error) {
    console.error("Erro ao cadastrar no Pagar.me:", error);
    return res.status(500).json({ message: "Erro ao processar a requisição" });
  }
});


app.get("/api/usuario-logado", (req, res) => {
  // Verifica se os dados do usuário estão na sessão
  if (req.session && req.session.userData) {
    res.json({
      success: true,
      usuario: req.session.userData, // Retorna os dados armazenados
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Nenhum usuário logado.",
    });
  }
});

// Rota para criar assinatura (cobrança recorrente) com pagamento via cartão de crédito
app.post("/criar-assinatura", async (req, res) => {
  const assinaturaData = req.body;

  try {
    // Configuração dos dados da assinatura
    const assinaturaPayload = {
      payment_method: "credit_card", // Método de pagamento
      interval: "month", // Intervalo de cobrança (exemplo: mensal)
      minimum_price: 500, // Preço mínimo
      interval_count: 1, // Quantidade de intervalos
      billing_type: "exact_day", // Tipo de faturamento
      installments: 1, // Parcelas
      customer: {
        name: assinaturaData.name,
      },
      card: {
        number: assinaturaData.card_number,
        holder_name: assinaturaData.card_holder_name,
        exp_month: assinaturaData.card_exp_month,
        exp_year: assinaturaData.card_exp_year,
        cvv: assinaturaData.card_cvv,
      },
      pricing_scheme: {
        scheme_type: "Unit",
        price: assinaturaData.price,
      },
      quantity: assinaturaData.quantity || 1, // Quantidade de itens
      billing_day: assinaturaData.billing_day || 10, // Dia de faturamento
      statement_descriptor: "Assinatura Higo", // Descrição na fatura
      customer_id: assinaturaData.customer_id,
      items: [
        {
          pricing_scheme: {
            scheme_type: "Unit",
            price: assinaturaData.price,
          },
          quantity: assinaturaData.quantity || 1,
          description: assinaturaData.item_description || "Assinatura Higo",
        },
      ],
    };

    // Envio da requisição para o Pagar.me
    console.log("Enviando dados para criar assinatura no Pagar.me...");
    const response = await axios.post(
      "https://api.pagar.me/core/v5/subscriptions",
      assinaturaPayload,
      {
        headers: {
          accept: "application/json",
          authorization:
            "Basic c2tfdGVzdF9lMzU5MjJmNmFmNzI0ZWRjOWM1NGE0NWI0ZWRjZjBmYTo=",
          "content-type": "application/json",
        },
      }
    );

    console.log("Assinatura criada com sucesso:", response.data);
    return res.status(200).json({
      message: "Assinatura criada com sucesso!",
      data: response.data,
    });
  } catch (error) {
    console.error("Erro ao criar assinatura no Pagar.me:", error.response?.data || error.message);
    return res.status(500).json({
      message: "Erro ao processar a criação da assinatura",
      error: error.response?.data || error.message,
    });
  }
});

//TOKEN API INTER
const generateToken = async () => {
  try {
    const response = await axios.post(
      "https://cdpj.partners.bancointer.com.br/oauth/v2/token",
      "client_id=3fea13df-1e68-447c-b306-a87d7c058024&client_secret=79f8d856-bb83-4ada-a5d0-01b22cfe43c1&scope=cob.write&grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        httpsAgent: new (require("https").Agent)({
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        }),
      }
    );

    const token = response.data.access_token;
    const data_geracao = new Date();

    // Atualizar o banco de dados com o novo token e a data de geração
    const query = `
    UPDATE token
    SET token = ?, data_geracao = ?
    WHERE id = 1;
  `;
    db.execute(query, [token, data_geracao], (err, results) => {
      if (err) {
        console.error("Erro ao atualizar o banco de dados:", err);
        return;
      }
      console.log("Token atualizado com sucesso no banco de dados.");
    });

    return token; // Agora retorna o token gerado
  } catch (error) {
    console.error("Erro ao gerar o token:", error);
    throw error; // Lança o erro para ser tratado na rota
  }
};

// Rota para gerar o token via API
app.post("/gerar-token", async (req, res) => {
  try {
    const token = await generateToken();
    res.status(200).json({
      success: true,
      token: token,
      message: "Token gerado e armazenado com sucesso!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao gerar o token.",
      error: error.message,
    });
  }
});

// Agendar a atualização do token a cada 40 minutos
cron.schedule("*/40 * * * *", async () => {
  try {
    console.log("Atualizando token via cron...");
    await generateToken();
    console.log("Token atualizado com sucesso via cron!");
  } catch (error) {
    console.error("Erro ao atualizar o token via cron:", error.message);
  }
});

const getTokenFromDatabase = async () => {
  try {
    // Executando a consulta de forma assíncrona
    const [rows] = await db.execute("SELECT token FROM token LIMIT 1");

    // Verificando se o token foi encontrado
    if (rows.length > 0) {
      return rows[0].token;
    } else {
      throw new Error("Token não encontrado.");
    }
  } catch (err) {
    throw new Error("Erro ao recuperar o token: " + err.message);
  }
};

app.post("/gerar-cobranca", async (req, res) => {
  // Informações que você já possui
  const token = await getTokenFromDatabase(); // Substitua pelo seu token real
  const contaCorrente = "409251879"; // Conta corrente selecionada

  // Corpo da requisição para criar a cobrança
  const corpo = {
    calendario: {
      expiracao: 3600,
    },
    valor: {
      original: "5.00", // Valor da cobrança
    },
    chave: "2b3925d5-d94c-4b96-9348-e6510ceae42d",
  };

  try {
    // Configurar a requisição para criar a cobrança
    const config = {
      method: "post",
      url: "https://cdpj.partners.bancointer.com.br/pix/v2/cob", // URL da API do Banco Inter para criação de cobrança
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-conta-corrente": contaCorrente,
      },
      httpsAgent: new (require("https").Agent)({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }),
      data: corpo,
    };

    // Realizar a requisição usando axios
    const response = await axios(config);

    // Retornar a resposta da cobrança ao cliente
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Erro ao gerar a cobrança:", error.message);

    // Se o erro for um erro de uma API externa (como Axios ou outro serviço), pode ser útil exibir mais detalhes:
    if (error.response) {
      // Caso a resposta da API contenha detalhes de erro, mostre a resposta completa
      console.error("Detalhes da resposta do erro:", {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data, // Dados de erro enviados pela API
      });

      // Retornar a resposta completa de erro ao cliente
      return res.status(error.response.status).json({
        error: "Falha ao gerar a cobrança.",
        details: error.response.data,
      });
    } else if (error.request) {
      // Caso não tenha recebido uma resposta, exiba os detalhes da requisição
      console.error("Detalhes da requisição do erro:", error.request);

      // Retornar erro de requisição sem resposta
      return res.status(500).json({
        error: "Falha ao realizar a requisição.",
        details: error.request,
      });
    } else {
      // Se o erro não for relacionado a uma resposta ou requisição, exiba o erro completo
      console.error("Erro desconhecido:", error);

      // Retornar erro genérico
      return res.status(500).json({
        error: "Falha ao gerar a cobrança.",
        details: error.message,
      });
    }
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(
    `Servidor rodando em: https://higopromopage.onrender.com/${PORT}`
  );
});
