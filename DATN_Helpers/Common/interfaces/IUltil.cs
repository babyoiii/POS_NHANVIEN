namespace DATN_Helpers.Common.interfaces
{
    public interface IUltil
    {
        //string GenerateJwt(LoginDTO user);

        string GenerateToken(Guid id, List<string> roles);
        string GenerateRefreshToken(Guid id, List<string> roles);
        string? GenerateTokenFromRefreshToken(string refreshToken);
        (Guid?, List<string>) ValidateToken(string token);
        bool IsAccessTokenExpired(string accessToken);
        
        string FormatMoney(long amount);
    }
} 