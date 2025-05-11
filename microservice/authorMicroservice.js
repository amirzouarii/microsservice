const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const connectDB = require('./config/database');
const Author = require('./models/Author');
require('dotenv').config();

// Configuration du protobuf
const authorProtoPath = path.join(__dirname, 'author.proto');
const authorProtoDefinition = protoLoader.loadSync(authorProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const authorProto = grpc.loadPackageDefinition(authorProtoDefinition).author;

// Connexion à MongoDB
connectDB();



const authorService = {
    getAuthor: async (call, callback) => {
        try {
            const authorId = call.request.author_id;
            const author = await Author.findById(authorId);
            
            if (!author) {
                callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Auteur non trouvé'
                });
                return;
            }

            // Conversion explicite de l'ID en chaîne
            const authorResponse = {
                id: author._id.toString(), // Conversion de l'ID en chaîne
                name: author.name,
                bio: author.bio
            };

            callback(null, { author: authorResponse });
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: 'Erreur lors de la récupération de l\'auteur'
            });
        }
    },
    
    searchAuthors: async (call, callback) => {
        try {
            const query = call.request.query.toLowerCase();
            const authors = await Author.find({
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { bio: { $regex: query, $options: 'i' } }
                ]
            });

            // Mapper les auteurs pour convertir l'ID en chaîne
            const authorsResponse = authors.map(author => ({
                id: author._id.toString(), // Conversion de l'ID en chaîne
                name: author.name,
                bio: author.bio
            }));

            callback(null, { authors: authorsResponse });
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: 'Erreur lors de la recherche des auteurs'
            });
        }
    },
    
    addAuthor: async (call, callback) => {
        try {
            const authorData = call.request.author;
            const newAuthor = new Author({
                name: authorData.name,
                bio: authorData.bio || ''
            });

            const savedAuthor = await newAuthor.save();

             // Envoi du message à Kafka
      await sendMessage('authors_topic', savedAuthor);  // Envoie l'auteur créé au topic 'authors_topic'

            // Conversion explicite de l'ID en chaîne
            const authorResponse = {
                id: savedAuthor._id.toString(), // Conversion de l'ID en chaîne
                name: savedAuthor.name,
                bio: savedAuthor.bio
            };

            callback(null, { author: authorResponse });
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: 'Erreur lors de l\'ajout de l\'auteur'
            });
        }
    }
};



// Création et démarrage du serveur gRPC
const server = new grpc.Server();
server.addService(authorProto.AuthorService.service, authorService);

const port = process.env.AUTHOR_SERVICE_PORT || 50052;
server.bindAsync(
    `0.0.0.0:${port}`, 
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
        if (err) {
            console.error('Échec de la liaison du serveur:', err);
            return;
        }
        console.log(`👤 Microservice d'auteurs en cours d'exécution sur le port ${port}`);
        server.start();
    }
);
