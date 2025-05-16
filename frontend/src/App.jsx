import { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import SignUp from './pages/SignUp';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import LogIn from './pages/LogIn';
import Home from './pages/Home';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/signup' element={<SignUp />}></Route>
        <Route path='/login' element={<LogIn />}></Route>
        <Route path='/home' element={<Home />}></Route>
      </Routes>

    </BrowserRouter>
  )
}

export default App;