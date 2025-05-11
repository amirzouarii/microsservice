const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    bio: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index pour la recherche
authorSchema.index({ name: 'text', bio: 'text' });

const Author = mongoose.model('Author', authorSchema);

module.exports = Author; 