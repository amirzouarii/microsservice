const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const connectDB = require('./config/database');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const path = require('path');

const { connectProducer, sendMessage } = require('./producer');



// Initialisation Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

connectDB();

// Configuration gRPC
const bookProtoPath = path.join(__dirname, 'book.proto');
const authorProtoPath = path.join(__dirname, 'author.proto');

const loadProto = (protoPath) => {
    return protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });
};

// Création des clients gRPC
const bookProto = grpc.loadPackageDefinition(loadProto(bookProtoPath)).book;
const authorProto = grpc.loadPackageDefinition(loadProto(authorProtoPath)).author;

const bookClient = new bookProto.BookService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

const authorClient = new authorProto.AuthorService(
    'localhost:50052',
    grpc.credentials.createInsecure()
);

// Promisify les appels gRPC
const promisifyGrpcCall = (client, method) => (request) => {
    return new Promise((resolve, reject) => {
        client[method](request, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
};

// Configuration Apollo Server
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: () => ({
        bookClient: {
            getBook: promisifyGrpcCall(bookClient, 'getBook'),
            searchBooks: promisifyGrpcCall(bookClient, 'searchBooks'),
            addBook: promisifyGrpcCall(bookClient, 'addBook')
        },
        authorClient: {
            getAuthor: promisifyGrpcCall(authorClient, 'getAuthor'),
            searchAuthors: promisifyGrpcCall(authorClient, 'searchAuthors'),
            addAuthor: promisifyGrpcCall(authorClient, 'addAuthor')
        }
    })
});


// Routes REST pour les livres
app.get('/api/books', async (req, res) => {
    try {
        const { query = '' } = req.query;
        const { books } = await promisifyGrpcCall(bookClient, 'searchBooks')({ query });
        res.json(books);
    } catch (err) {
        console.error('Erreur lors de la recherche des livres:', err);
        res.status(500).json({ error: 'Erreur lors de la recherche des livres' });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { book } = await promisifyGrpcCall(bookClient, 'getBook')({ book_id: id });
        if (!book) {
            return res.status(404).json({ error: 'Livre non trouvé' });
        }
        res.json(book);
    } catch (err) {
        console.error('Erreur lors de la récupération du livre:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération du livre' });
    }
});

app.post('/api/books', async (req, res) => {
    try {
        const { title, author, description } = req.body;
        if (!title || !author) {
            return res.status(400).json({ error: 'Le titre et l\'auteur sont requis' });
        }
        const { book } = await promisifyGrpcCall(bookClient, 'addBook')({
            book: { title, author, description }
        });
        await sendMessage('books_topic', book);

        res.status(201).json(book);
    } catch (err) {
        console.error('Erreur lors de l\'ajout du livre:', err);
        res.status(400).json({ error: 'Erreur lors de l\'ajout du livre' });
    }
});

// Routes REST pour les auteurs
app.get('/api/authors', async (req, res) => {
    try {
        const { query = '' } = req.query;
        const { authors } = await promisifyGrpcCall(authorClient, 'searchAuthors')({ query });
        res.json(authors);
    } catch (err) {
        console.error('Erreur lors de la recherche des auteurs:', err);
        res.status(500).json({ error: 'Erreur lors de la recherche des auteurs' });
    }
});

app.get('/api/authors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { author } = await promisifyGrpcCall(authorClient, 'getAuthor')({ author_id: id });
        if (!author) {
            return res.status(404).json({ error: 'Auteur non trouvé' });
        }
        res.json(author);
    } catch (err) {
        console.error('Erreur lors de la récupération de l\'auteur:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'auteur' });
    }
});

app.post('/api/authors', async (req, res) => {
    try {
        const { name, bio } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Le nom est requis' });
        }
        const { author } = await promisifyGrpcCall(authorClient, 'addAuthor')({
            author: { name, bio }
        });
        await sendMessage('authors_topic', author);

        res.status(201).json(author);
    } catch (err) {
        console.error('Erreur lors de l\'ajout de l\'auteur:', err);
        res.status(400).json({ error: 'Erreur lors de l\'ajout de l\'auteur' });
    }
});

// Démarrer les services
async function startServer() {
    await connectProducer(); // Connexion au producteur Kafka

    await server.start();
    
    app.use(
        '/graphql',
        expressMiddleware(server, {
            context: async ({ req }) => ({
                bookClient: {
                    getBook: promisifyGrpcCall(bookClient, 'getBook'),
                    searchBooks: promisifyGrpcCall(bookClient, 'searchBooks'),
                    addBook: promisifyGrpcCall(bookClient, 'addBook')
                },
                authorClient: {
                    getAuthor: promisifyGrpcCall(authorClient, 'getAuthor'),
                    searchAuthors: promisifyGrpcCall(authorClient, 'searchAuthors'),
                    addAuthor: promisifyGrpcCall(authorClient, 'addAuthor')
                }
            })
        })
    );

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📚 GraphQL disponible sur /graphql`);
        console.log(`📖 REST API disponible sur /api/books et /api/authors`);
    });
}

startServer().catch(err => {
    console.error('Erreur lors du démarrage du serveur:', err);
    process.exit(1);
});