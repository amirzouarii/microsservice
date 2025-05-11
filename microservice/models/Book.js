const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index pour la recherche
bookSchema.index({ title: 'text', author: 'text', description: 'text' });

const Book = mongoose.model('Book', bookSchema);

module.exports = Book; 