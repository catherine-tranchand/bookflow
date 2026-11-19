import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Image, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalContext } from '../../context/GlobalProvider';
import { router } from 'expo-router';
import { signOut, updateUser } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { getUserBooks } from '../../lib/supabase';
import {
  getWishlistItems,
  addWishlistEntries,
  removeWishlistItem,
} from '../../lib/wishlist';

// ─── Données statiques ─────────────────────────────────────────────────────────

const GENRES = [
  { id: 'fantastique', label: '🧙 Fantastique' },
  { id: 'classique', label: '📜 Classique' },
  { id: 'roman', label: '💬 Roman' },
  { id: 'policier', label: '🔍 Policier' },
  { id: 'sf', label: '🚀 Science-Fiction' },
  { id: 'histoire', label: '🏛️ Histoire' },
  { id: 'biographie', label: '👤 Biographie' },
  { id: 'jeunesse', label: '🌟 Jeunesse' },
  { id: 'psychologie', label: '🧠 Psychologie' },
];

const LANGUAGE_LABELS = {
  fr: '🇫🇷 Français',
  ru: '🇷🇺 Русский',
  en: '🇬🇧 English',
};

// ─── Composant principal ───────────────────────────────────────────────────────

export default function Profile() {
  const { user, setUser, setIsLoggedIn } = useGlobalContext();

  // genres est un array text[] dans Supabase
  const userGenres = user?.genres ?? [];

  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistInput, setWishlistInput] = useState('');
  const [addingWishlist, setAddingWishlist] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState(userGenres);
  const [myBooks, setMyBooks] = useState([]); 

  useEffect(() => {
    if (user?.id) {
      getUserBooks(user.id)
      .then(setMyBooks)
      .catch((e) => console.log('getUsersBooks error', e.message));
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      getWishlistItems(user.id)
        .then(setWishlistItems)
        .catch((e) => console.log('getWishlistItems error', e.message));
    }
  }, [user?.id]);

  // avatar picker

  const [avatarUri, setAvatarUri] = useState(null);

  const pickAvatar = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (!result.canceled) setAvatarUri(result.assets[0].uri);
};

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const toggleGenre = (id) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleAddWishlist = async () => {
    const clean = wishlistInput.trim();
    if (!clean || addingWishlist) return;

    setAddingWishlist(true);
    try {
      const added = await addWishlistEntries(user.id, clean);
      setWishlistItems((prev) => [...added, ...prev]);
      setWishlistInput('');
      Keyboard.dismiss();
    } catch (error) {
      console.log('handleAddWishlist error:', error.message);
      Alert.alert('Erreur', "Impossible d'ajouter ce livre.");
    } finally {
      setAddingWishlist(false);
    }
  };

  const handleRemoveWishlist = async (id) => {
    const backup = wishlistItems;
    setWishlistItems((prev) => prev.filter((w) => w.id !== id));
    try {
      await removeWishlistItem(id);
    } catch (error) {
      console.log('handleRemoveWishlist error:', error.message);
      setWishlistItems(backup);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await updateUser(user.id, {
        bio,
        genres: selectedGenres,
      }, avatarUri);
      setUser({ ...user, ...updated });
      setIsEditing(false);
      Alert.alert('✅ Profil mis à jour !');
    } catch (error) {
      console.log('handleSave error:', error.message, error);
      Alert.alert('Erreur', error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      setIsLoggedIn(false);
      router.replace('/');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 py-6">

          {/* ── Header : avatar + infos ── */}
<View className="items-center mb-6">
  
  {/* Avatar cliquable en mode édition */}
  <TouchableOpacity onPress={isEditing ? pickAvatar : null}>
    <View className="w-24 h-24 rounded-full bg-secondary-100 items-center justify-center mb-1">
      {(avatarUri || user?.avatar) ? (
        <Image
          source={{ uri: avatarUri || user.avatar }}
          className="w-24 h-24 rounded-full"
          resizeMode="cover"
        />
      ) : (
        <Text className="text-4xl font-pbold text-primary">
          {user?.username?.charAt(0).toUpperCase() || '?'}
        </Text>
      )}
    </View>
    {isEditing && (
      <Text className="text-secondary-100 text-xs font-pmedium text-center mt-1 mb-2">
        Changer la photo
      </Text>
    )}
  </TouchableOpacity>

  <Text className="text-2xl font-pbold text-white">{user?.username}</Text>
  <Text className="text-sm text-gray-100 font-pregular mt-1">{user?.email}</Text>
            {/* Badges ville + langue */}
            <View className="flex-row gap-2 mt-3">
              {user?.city && (
                <View className="bg-black-200 px-3 py-1 rounded-full">
                  <Text className="text-secondary-100 font-pmedium text-sm">📍 {user.city}</Text>
                </View>
              )}
              {user?.language && (
                <View className="bg-black-200 px-3 py-1 rounded-full">
                  <Text className="text-secondary-100 font-pmedium text-sm">
                    {LANGUAGE_LABELS[user.language] || user.language}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Genres préférés ── */}
          <View className="mb-6">
            <Text className="text-white font-psemibold text-lg mb-3">📚 Genres préférés</Text>
            <View className="flex-row flex-wrap gap-2">
              {GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre.id);
                const isUserGenre = userGenres.includes(genre.id);

                // En mode lecture, afficher seulement les genres de l'user
                if (!isEditing && !isUserGenre) return null;

                return (
                  <TouchableOpacity
                    key={genre.id}
                    onPress={() => isEditing && toggleGenre(genre.id)}
                    className={`px-4 py-2 rounded-xl border ${
                      isSelected
                        ? 'bg-secondary-100 border-secondary-100'
                        : 'bg-black-200 border-gray-100'
                    }`}
                  >
                    <Text className={`text-sm font-pmedium ${
                      isSelected ? 'text-primary' : 'text-white'
                    }`}>
                      {genre.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {!isEditing && userGenres.length === 0 && (
                <Text className="text-gray-100 font-pregular text-sm italic">
                  Aucun genre sélectionné
                </Text>
              )}
            </View>
          </View>

          {/* ── Bio ── */}
          <View className="mb-6">
            <Text className="text-white font-psemibold text-lg mb-3">🖊️ Bio</Text>
            {isEditing ? (
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Parle de toi... (facultatif)"
                placeholderTextColor="#CDCDE0"
                multiline
                numberOfLines={4}
                className="bg-black-200 text-white font-pregular p-4 rounded-xl border border-gray-100"
                style={{ textAlignVertical: 'top' }}
              />
            ) : (
              <Text className="text-white font-pregular text-sm">
                {bio || <Text className="italic">Aucune bio renseignée</Text>}
              </Text>
            )}
          </View>

          {/* ── Wishlist ── */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white font-psemibold text-lg">🔖 Livres à lire</Text>
              {!isEditing && (
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Text className="text-secondary-100 font-pmedium text-sm">+ Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditing && (
              <View className="flex-row items-center gap-2 mb-3">
                <TextInput
                  value={wishlistInput}
                  onChangeText={setWishlistInput}
                  onSubmitEditing={handleAddWishlist}
                  returnKeyType="done"
                  editable={!addingWishlist}
                  placeholder="Ex: Мастер и Маргарита"
                  placeholderTextColor="#CDCDE0"
                  className="flex-1 bg-black-200 text-white font-pregular px-4 py-3 rounded-xl border border-gray-100"
                />
                <TouchableOpacity
                  onPress={handleAddWishlist}
                  disabled={addingWishlist || !wishlistInput.trim()}
                  className="bg-secondary-100 rounded-xl px-5 py-3"
                  style={{ opacity: addingWishlist || !wishlistInput.trim() ? 0.4 : 1 }}
                >
                  {addingWishlist ? (
                    <ActivityIndicator size="small" color="#161622" />
                  ) : (
                    <Text className="text-primary font-pbold">+</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View className="flex-row flex-wrap gap-2">
              {wishlistItems.length === 0 ? (
                <Text className="text-gray-100 font-pregular text-sm italic">
                  Aucun livre dans la wishlist
                </Text>
              ) : (
                wishlistItems.map((item) => (
                  <View
                    key={item.id}
                    className="flex-row items-center bg-black-200 border border-secondary-100 rounded-xl px-3 py-2 gap-2"
                  >
                    <Text className="text-secondary-100 font-pmedium text-sm">
                      {item.title ?? item.raw_text}
                    </Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveWishlist(item.id)}>
                        <Text className="text-gray-100 text-xs">✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>

          {/* ── Mes livres ── */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white font-psemibold text-lg">📖 Mes livres</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/add-book')}>
                <Text className="text-secondary-100 font-pmedium text-sm">+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {myBooks && myBooks.length > 0 ? (
              <View className="flex-row flex-wrap gap-3">
                {myBooks.map((book) => (
                  <TouchableOpacity
                    key={book.id}
                    className="bg-black-200 rounded-2xl overflow-hidden"
                    style={{ width: '47%' }}
                  >
                    {book.image ? (
                      <Image source={{ uri: book.image }} className="w-full h-36" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-36 bg-black-100 items-center justify-center">
                        <Text className="text-4xl">📚</Text>
                      </View>
                    )}
                    <View className="p-3">
                      <Text className="text-white font-pmedium text-sm" numberOfLines={2}>{book.title}</Text>
                      <Text className="text-secondary-100 font-pregular text-xs mt-1">{book.author}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="bg-black-200 rounded-2xl p-6 items-center">
                <Text className="text-4xl mb-2">📭</Text>
                <Text className="text-white font-pmedium text-center">
                  Tu n'as pas encore ajouté de livres
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/add-book')}
                  className="bg-secondary-100 px-6 py-2 rounded-xl mt-4"
                >
                  <Text className="text-primary font-psemibold">Ajouter un livre</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Bouton édition ── */}
          <TouchableOpacity
            onPress={() => isEditing ? handleSave() : setIsEditing(true)}
            className="bg-secondary-100 rounded-xl py-3 mt-4 items-center"
          >
            <Text className="text-primary font-psemibold text-base">
              {isEditing ? '✅ Sauvegarder' : '✏️ Modifier le profil'}
            </Text>
          </TouchableOpacity>

          {/* ── Déconnexion ── */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-black-200 border border-red-500 rounded-xl py-3 items-center mt-3"
          >
            <Text className="text-red-500 font-psemibold text-base">🚪 Se déconnecter</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}