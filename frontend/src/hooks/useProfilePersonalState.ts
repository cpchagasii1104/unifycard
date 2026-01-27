import { useState } from "react";

export function useProfilePersonalState() {
  // Formulário Pessoal
  const [fullName, setFullName] = useState("");
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [hasFullName, setHasFullName] = useState(false); // 🔴 IMUTABILIDADE: Flag para detectar se fullName já foi cadastrado
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfValidating, setCpfValidating] = useState(false);
  const [hasCpf, setHasCpf] = useState(false); // 🔴 IMUTABILIDADE: Flag para detectar se CPF já foi cadastrado
  const [birthdate, setBirthdate] = useState("");
  const [birthdateError, setBirthdateError] = useState<string | null>(null);
  const [userAge, setUserAge] = useState<number | undefined>(undefined);
  const [hasBirthdate, setHasBirthdate] = useState(false); // 🔴 IMUTABILIDADE: Flag para detectar se birthdate já foi cadastrado
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [genderError, setGenderError] = useState<string | null>(null);
  const [hasGender, setHasGender] = useState(false); // 🔴 IMUTABILIDADE: Flag para detectar se gender já foi cadastrado
  const [countryCode, setCountryCode] = useState("55");
  const [areaCode, setAreaCode] = useState("41");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [cep, _setCep] = useState("");
  const [cepError, setCepError] = useState<string | null>(null);
  const [address, _setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressNumber, _setAddressNumber] = useState("");
  const [addressNumberError, setAddressNumberError] = useState<string | null>(
    null,
  );
  const [complement, _setComplement] = useState("");
  const [neighborhood, _setNeighborhood] = useState("");
  const [neighborhoodError, setNeighborhoodError] = useState<string | null>(
    null,
  );
  const [city, _setCity] = useState("");
  const [cityError, setCityError] = useState<string | null>(null);
  const [state, _setState] = useState("");
  const [stateError, setStateError] = useState<string | null>(null);

  return {
    fullName,
    setFullName,
    fullNameError,
    setFullNameError,
    hasFullName,
    setHasFullName,
    cpf,
    setCpf,
    cpfError,
    setCpfError,
    cpfValidating,
    setCpfValidating,
    hasCpf,
    setHasCpf,
    birthdate,
    setBirthdate,
    birthdateError,
    setBirthdateError,
    userAge,
    setUserAge,
    hasBirthdate,
    setHasBirthdate,
    gender,
    setGender,
    genderError,
    setGenderError,
    hasGender,
    setHasGender,
    countryCode,
    setCountryCode,
    areaCode,
    setAreaCode,
    phoneNumber,
    setPhoneNumber,
    phoneError,
    setPhoneError,
    cep,
    _setCep,
    cepError,
    setCepError,
    address,
    _setAddress,
    addressError,
    setAddressError,
    addressNumber,
    _setAddressNumber,
    addressNumberError,
    setAddressNumberError,
    complement,
    _setComplement,
    neighborhood,
    _setNeighborhood,
    neighborhoodError,
    setNeighborhoodError,
    city,
    _setCity,
    cityError,
    setCityError,
    state,
    _setState,
    stateError,
    setStateError,
  };
}



