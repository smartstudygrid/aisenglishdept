// firebase-init.js — Firebase bootstrap (ES module, deferred).
// Sets window.db / window.auth + bridged SDK helpers for the classic scripts below.
// Source: index.single.html <script type="module"> (imports + cfg/app/db + setPersistence).
import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore,initializeFirestore,persistentLocalCache,persistentSingleTabManager,collection,doc,getDoc,getDocs,arrayUnion,arrayRemove,setDoc,updateDoc,deleteDoc,onSnapshot,writeBatch} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence,reauthenticateWithCredential,EmailAuthProvider,updatePassword,deleteUser,signInAnonymously} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const cfg={apiKey:"AIzaSyDkGhScAIq0tkzEosWkScD0doTq9VyLaq4",authDomain:"cricketscoreapp-fa258.firebaseapp.com",projectId:"cricketscoreapp-fa258",storageBucket:"cricketscoreapp-fa258.firebasestorage.app",messagingSenderId:"833946397398",appId:"1:833946397398:web:a14bba67a7e3cbab9d7777"};
const app=getApps().length?getApps()[0]:initializeApp(cfg);
let db;
try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentSingleTabManager()})});}
catch{db=getFirestore(app);}
const auth=getAuth(app);
try{await setPersistence(auth,browserLocalPersistence);}catch{}

// Bridge SDK symbols onto window so classic scripts (core/home/squad/scorer/boot)
// keep working with bare identifiers, exactly as in the single-file build.
window.db = db;
window.auth = auth;
window.getAuth = getAuth;
window.getApps = getApps;
window.initializeApp = initializeApp;
window.cfg = cfg;
window.collection = collection;
window.doc = doc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.arrayUnion = arrayUnion;
window.arrayRemove = arrayRemove;
window.setDoc = setDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.onSnapshot = onSnapshot;
window.writeBatch = writeBatch;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.sendEmailVerification = sendEmailVerification;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.setPersistence = setPersistence;
window.browserLocalPersistence = browserLocalPersistence;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.EmailAuthProvider = EmailAuthProvider;
window.updatePassword = updatePassword;
window.deleteUser = deleteUser;
window.signInAnonymously = signInAnonymously;

// Release the boot script (see index.html inline promise).
if (window.__firebaseResolve) window.__firebaseResolve(true);
