import { describe, it, expect } from 'vitest'
import {
  erroDoTelefone, mascararTelefone, normalizarTelefone, telefoneValido,
} from '@/core/telefone'

describe('telefone', () => {
  it('aceita vazio: 30% dos cadastros reais não têm telefone', () => {
    expect(erroDoTelefone('')).toBeNull()
    expect(erroDoTelefone(null)).toBeNull()
    expect(erroDoTelefone('   ')).toBeNull()
  })

  it('recusa o número sem DDD, que é o formato da planilha antiga', () => {
    // "9.8109-1840" é exatamente como o MGM escreve na lista de turma
    expect(erroDoTelefone('9.8109-1840')).toMatch(/DDD/)
    expect(erroDoTelefone('3344-5566')).toMatch(/DDD/)
  })

  it('aceita fixo com DDD e celular com o nono dígito', () => {
    expect(telefoneValido('(44) 3344-5566')).toBe(true)
    expect(telefoneValido('44988776655')).toBe(true)
  })

  it('recusa DDD que não existe', () => {
    // 10 e 20 não são DDD de lugar nenhum; quem digitou trocou um dígito
    expect(erroDoTelefone('1098765432')).toMatch(/não é um DDD/)
    expect(erroDoTelefone('20987654321')).toMatch(/não é um DDD/)
  })

  it('recusa celular de 11 dígitos que não começa com 9', () => {
    expect(erroDoTelefone('44888776655')).toMatch(/começa com 9/)
  })

  it('escreve a máscara enquanto se digita, sem travar no meio', () => {
    expect(mascararTelefone('4')).toBe('4')
    expect(mascararTelefone('44')).toBe('44')
    expect(mascararTelefone('4498')).toBe('(44) 98')
    expect(mascararTelefone('4498877')).toBe('(44) 9887-7')
    expect(mascararTelefone('44988776655')).toBe('(44) 98877-6655')
    // e não deixa passar do tamanho de um telefone brasileiro
    expect(mascararTelefone('449887766551234')).toBe('(44) 98877-6655')
  })

  it('guarda só dígitos, porque a máscara é da tela', () => {
    expect(normalizarTelefone('(44) 98877-6655')).toBe('44988776655')
    expect(normalizarTelefone('')).toBeNull()
  })
})
