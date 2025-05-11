const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const connectDB = require('./config/database');
const Book = require('./models/Book');
require('dotenv').config();

// Configuration du protobuf
const bookProtoPath = path.join(__dirname, 'book.proto');
const bookProtoDefinition = protoLoader.loadSync(bookProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const bookProto = grpc.loadPackageDefinition(bookProtoDefinition).book;

// Connexion à MongoDB
connectDB();


const bookService = {
    getBook: async (call, callback) => {
        try {
            const bookId = call.request.book_id;
            const book = await Book.findById(bookId);
            
            if (!book) {
                callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Livre non trouvé'
                });
                return;
            }

            // Conversion explicite de l'ID en chaîne
            const bookResponse = {
                id: book._id.toString(), // Conversion de l'ID en chaîne
                title: book.title,
                author: book.author,
                description: book.description
            };
            
            callback(null, { book: bookResponse });
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: 'Erreur lors de la récupération du livre'
            });
        }
    },

    searchBooks: async (call, callback) => {
        try {
            const query = call.request.query.toLowerCase();
            const books = await Book.find({
                $or: [
                    { title: { $regex: query, $options: 'i' } },
                    { author: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } }
                ]
            });

            // Mapper les livres pour convertir l'ID en chaîne
            const booksResponse = books.map(book => ({
                id: book._id.toString(), // Conversion de l'ID en chaîne
                title: book.title,
                author: book.author,
                description: book.description
            }));
            
            callback(null, { books: booksResponse });
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: 'Erreur lors de la recherche des livres'
            });
        }
    },

    addBook: async (call, callback) => {
        try {
            const bookData = call.request.book;
    
            // Validation des données
            if (!bookData.title || !bookData.author) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Le titre et l\'auteur sont requis.'
                });
            }
    
            const newBook = new Book({
                title: bookData.title,
                author: bookData.author,
                description: bookData.description || ''
            });
    
            // Sauvegarde du livre dans la base de données
            const savedBook = await newBook.save();
    
            // Vérifie si le livre a été sauvegardé correctement
            if (!savedBook) {
                return callback({
                    code: grpc.status.INTERNAL,
                    message: 'Erreur lors de l\'ajout du livre dans la base de données.'
                });
            }
    
            // Envoi du message Kafka, avec gestion d'erreur
            try {
                await sendMessage('books_topic', savedBook); // Envoie le livre créé au topic 'books_topic'
            } catch (kafkaError) {
                console.error("Erreur lors de l'envoi du message Kafka:", kafkaError);
                return callback({
                    code: grpc.status.INTERNAL,
                    message: 'Erreur lors de l\'envoi du message Kafka.'
                });
            }
    
            // Conversion de l'ID en chaîne et préparation de la réponse
            const bookResponse = {
                id: savedBook._id.toString(),  // Conversion explicite de l'ID en chaîne
                title: savedBook.title,
                author: savedBook.author,
                description: savedBook.description
            };
    
            // Envoie de la réponse au client
            callback(null, { book: bookResponse });
            
        } catch (error) {
            console.error('Erreur lors de l\'ajout du livre:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Erreur lors de l\'ajout du livre'
            });
        }
    }
    
};


// Création et démarrage du serveur gRPC
const server = new grpc.Server();
server.addService(bookProto.BookService.service, bookService);

const port = process.env.BOOK_SERVICE_PORT || 50051;
server.bindAsync(
    `0.0.0.0:${port}`, 
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
        if (err) {
            console.error('Échec de la liaison du serveur:', err);
            return;
        }
        console.log(`📚 Microservice de livres en cours d'exécution sur le port ${port}`);
        server.start();
    }
);